import 'dotenv/config';

export const services = [
    {
        route: "/user-service",
        target: process.env.USER_SERVICE_URL,
    },
    {
        route: "/station-service",
        target: process.env.STATION_SERVICE_URL,
    }
];