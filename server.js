const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}));

const CACHE_TTL = 55000;
const cache = new Map();

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
    res.send("POCKET OPTION LIVE AI V12 SERVER RUNNING");
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "online",
        version: "V12",
        apiConfigured: Boolean(API_KEY),
        cacheEntries: cache.size,
        time: new Date().toISOString()
    });
});

app.get("/api/forex", async (req, res) => {

    try {

        if (!API_KEY) {
            return res.status(500).json({
                error: "Twelve Data API key is not configured"
            });
        }

        const symbol = req.query.symbol || "EUR/USD";
        const interval = req.query.interval || "1min";

        if (!allowedIntervals.includes(interval)) {
            return res.status(400).json({
                error: "Unsupported interval"
            });
        }

        const cacheKey = `${symbol}_${interval}`;

        const now = Date.now();

        const cached = cache.get(cacheKey);

        if (cached && now - cached.timestamp < CACHE_TTL) {

            return res.json({
                ...cached.data,
                cached: true,
                cacheAge: Math.floor(
                    (now - cached.timestamp) / 1000
                )
            });

        }

        const url = new URL(
            "https://api.twelvedata.com/time_series"
        );

        url.searchParams.set("symbol", symbol);
        url.searchParams.set("interval", interval);
        url.searchParams.set("outputsize", "500");
        url.searchParams.set("apikey", API_KEY);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(15000)
        });

        const data = await response.json();

        if (!response.ok || data.status === "error") {

            return res.status(502).json({
                error: data.message || "Twelve Data API error",
                cached: false
            });

        }

        if (!Array.isArray(data.values)) {

            return res.status(502).json({
                error: "Invalid Twelve Data response"
            });

        }

        cache.set(cacheKey, {
            timestamp: now,
            data
        });

        res.json({
            ...data,
            cached: false,
            serverTime: new Date().toISOString()
        });

    } catch (error) {

        res.status(500).json({
            error: "Server error",
            details: error.message
        });

    }

});

app.listen(PORT, () => {
    console.log(
        `POCKET OPTION LIVE AI V12 running on port ${PORT}`
    );
});