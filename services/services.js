import 'dotenv/config';

export const services = [
    {
        route: "/user-service",
        target: process.env.USER_SERVICE_URL,
    },
];