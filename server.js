const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}));

const CACHE_TTL = 65000;
const cache = new Map();
const pendingRequests = new Map();

const allowedIntervals = [
    "1min",
    "5min",
    "15min",
    "30min",
    "1h",
    "2h",
    "4h",
    "1day"
];

app.get("/", (req, res) => {
    res.send("POCKET OPTION LIVE AI V12 PRO SERVER RUNNING");
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        version: "V12 PRO",
        apiConfigured: Boolean(API_KEY),
        cacheEntries: cache.size,
        pendingRequests: pendingRequests.size,
        time: new Date().toISOString()
    });
});

async function fetchTwelveData(symbol, interval) {

    const url = new URL(
        "https://api.twelvedata.com/time_series"
    );

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", "500");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", API_KEY);

    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (!response.ok || data.status === "error" || data.code) {
        throw new Error(
            data.message || "Twelve Data API error"
        );
    }

    if (!Array.isArray(data.values)) {
        throw new Error("Invalid Twelve Data response");
    }

    return data;
}

app.get("/api/forex", async (req, res) => {

    const symbol = String(
        req.query.symbol || "EUR/USD"
    ).toUpperCase();

    const interval = String(
        req.query.interval || "1min"
    );

    if (!API_KEY) {
        return res.status(500).json({
            error: "Twelve Data API key is not configured"
        });
    }

    if (!allowedIntervals.includes(interval)) {
        return res.status(400).json({
            error: "Unsupported interval"
        });
    }

    if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(symbol)) {
        return res.status(400).json({
            error: "Invalid Forex symbol"
        });
    }

    const cacheKey = `${symbol}_${interval}`;
    const now = Date.now();

    const cached = cache.get(cacheKey);

    if (
        cached &&
        now - cached.timestamp < CACHE_TTL
    ) {
        return res.json({
            ...cached.data,
            cached: true,
            cacheAge: Math.floor(
                (now - cached.timestamp) / 1000
            )
        });
    }

    try {

        let request = pendingRequests.get(cacheKey);

        if (!request) {

            request = fetchTwelveData(symbol, interval)
                .then(data => {

                    cache.set(cacheKey, {
                        timestamp: Date.now(),
                        data
                    });

                    return data;

                })
                .finally(() => {
                    pendingRequests.delete(cacheKey);
                });

            pendingRequests.set(cacheKey, request);
        }

        const data = await request;

        return res.json({
            ...data,
            cached: false,
            serverTime: new Date().toISOString()
        });

    } catch (error) {

        // Əvvəlki məlumat varsa, ehtiyat kimi qaytar.
        if (cached) {
            return res.json({
                ...cached.data,
                cached: true,
                stale: true,
                warning: error.message,
                cacheAge: Math.floor(
                    (Date.now() - cached.timestamp) / 1000
                )
            });
        }

        return res.status(502).json({
            error: "Twelve Data connection failed",
            details: error.message
        });

    }

});

app.listen(PORT, () => {
    console.log(
        `POCKET OPTION LIVE AI V12 PRO running on port ${PORT}`
    );
});