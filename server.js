const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}));

app.get("/", (req, res) => {
    res.send("Pocket Option AI V11 Server is running");
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

        const allowedIntervals = [
            "1min", "5min", "15min", "30min",
            "1h", "2h", "4h", "1day"
        ];

        if (!allowedIntervals.includes(interval)) {
            return res.status(400).json({
                error: "Unsupported interval"
            });
        }

        const url = new URL(
            "https://api.twelvedata.com/time_series"
        );

        url.searchParams.set("symbol", symbol);
        url.searchParams.set("interval", interval);
        url.searchParams.set("outputsize", "500");
        url.searchParams.set("apikey", API_KEY);

        const response = await fetch(url);
        const data = await response.json();

        res.status(response.ok ? 200 : 502).json(data);

    } catch (error) {
        res.status(500).json({
            error: "Server error",
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`V11 server running on port ${PORT}`);
});
