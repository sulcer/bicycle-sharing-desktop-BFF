import express from 'express';
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { services } from "./services/services.js";
import 'dotenv/config';
import * as protoLoader from "@grpc/proto-loader";
import * as grpc from "@grpc/grpc-js";
import axios from "axios";
import jwt from "jsonwebtoken";

const packageDefinition = protoLoader.loadSync('proto/payment.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const service = grpc.loadPackageDefinition(packageDefinition).payment;

const client = new service.PaymentGrpcService(process.env.PAYMENT_SERVICE_URL, grpc.credentials.createInsecure());

const app = express();
const port = 3005 || process.env.PORT;

app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json());

// jwt authentication
app.post('/login', (req, res) => {
    const username = req.body.username;
    const user = { name: username };

    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);

    res.json({ accessToken: accessToken, refreshToken: refreshToken });
});


let refreshTokens = [];
app.post('/token', (req, res) => {
    const refreshToken = req.body.token;
    if (refreshToken == null) return res.sendStatus(401);
    if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        const accessToken = jwt.sign({ name: user.name }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        res.json({ accessToken: accessToken });
    });
});

app.delete('/logout', (req, res) => {
    refreshTokens = refreshTokens.filter(token => token !== req.body.token);
    res.sendStatus(204);
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

const rateLimit = process.env.RATELIMIT;
const rateLimitInterval = process.env.RATELIMIT_WINDOW;

const requestCount = {};

setInterval(() => {
    Object.keys(requestCount).forEach((ip) => {
        requestCount[ip] = 0;
    });
}, rateLimitInterval);

const rateLimiter = (req, res, next) => {
    const ip = req.ip;
    requestCount[ip] = requestCount[ip] ? requestCount[ip] + 1 : 1;

    if (requestCount[ip] > rateLimit) {
        return res.status(429).json({
            code: 429,
            status: "Error",
            message: "Rate limit exceeded.",
            data: null,
        });
    }

    req.setTimeout(15000, () => {
        res.status(504).json({
            code: 504,
            status: "Error",
            message: "Gateway timeout.",
            data: null,
        });
        req.abort();
    });

    next();
}

app.use(rateLimiter);

services.forEach(({ route, target }) => {
    const proxyOptions = {
        target,
        changeOrigin: true,
        pathRewrite: {
            [`^${route}`]: "",
        },
    };

    app.use(route, rateLimiter, createProxyMiddleware(proxyOptions));
});

app.get('/payment-service/getAll', authenticateToken, (req, res) => {
    client.GetAllPayments({}, (error, response) => {
        if (error) {
            console.error(error);
            return;
        }

        res.json(response);
    });
});

app.get('/payment-service/getOne', authenticateToken, (req, res) => {
    client.GetPayment(req.body, (error, response) => {
        if (error) {
            console.error(error);
            return;
        }

        res.json(response);
    });
});

app.post('/payment-service/add', authenticateToken, (req, res) => {
    client.CreatePayment(req.body, (error, response) => {
        if (error) {
            console.error(error);
            return;
        }

        res.json(response);
    });
});

app.put('/payment-service/update', authenticateToken, (req, res) => {
    client.UpdatePayment(req.body, (error, response) => {
        if (error) {
            console.error(error);
            return;
        }

        res.json(response);
    });
});

app.delete('/payment-service/delete', authenticateToken, (req, res) => {
    client.DeletePayment(req.body, (error, response) => {
        if (error) {
            console.error(error);
            return;
        }

        res.json(response);
    });
});

app.post('/users-service/create', authenticateToken, (req, res) => {
    console.log(req.body);
    axios.post(`${process.env.USER_SERVICE_URL}/users`, req.body).then(r => {
        res.json(r.data);
    });
});

app.post('/stations-service/create', authenticateToken, (req, res) => {
    console.log(req.body);
    axios.post(`${process.env.STATION_SERVICE_URL}/station/`, req.body).then(r => {
        res.json(r.data);
    });
});

app.listen(port, () => {
    console.log(`Gateway running on http://localhost:${port}`);
});