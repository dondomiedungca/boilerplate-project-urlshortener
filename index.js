require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const dns = require("node:dns");
const dnsPromises = dns.promises;
const { MongoClient } = require("mongodb");
const axios = require("axios");
const psl = require("psl");

// Basic Configuration
const port = process.env.PORT || 3003;

const url = "";
const client = new MongoClient(url);
const db = client.db("sample_mflix");
const collectionName = "short_urls";

const isValidUrl = (urlString) => {
  var urlPattern = new RegExp(
    "^(https?:\\/\\/)?" + // validate protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // validate domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // validate OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // validate port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // validate query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); // validate fragment locator
  return !!urlPattern.test(urlString);
};

const getNextCounter = async (key) => {
  var ret = await db.collection("counters").findOne({ key });
  db.collection("counters").updateOne(
    { key },
    { $set: { counter: Number(ret.counter) + 1 } }
  );
  return Number(ret.counter) + 1;
};

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.get("/api/shorturl/:shorturl", async (req, res) => {
  console.log("triggered");
  const short_url = Number(req.params.shorturl);
  if (isNaN(short_url)) {
    res.json({ error: "Wrong format" });
  }
  const original_url = await db
    .collection(collectionName)
    .findOne({ short_url });

  if (!!original_url) {
    console.log("redirecting");
    res.redirect(original_url.original_url);
  }
});

app.post("/api/shorturl", express.json(), async function (req, res, next) {
  const url = req.body.url;
  try {
    if (!url.length) {
      throw 400;
    }
    if (!isValidUrl(url) || !url.includes("http")) {
      throw 400;
    }
    const fetch = await axios.get(url);
    if (fetch.statusText !== "OK") {
      throw 400;
    }
    const collection = db.collection(collectionName);
    const filteredDocs = await collection.find({ original_url: url }).toArray();
    let short_url;
    if (filteredDocs.length) {
      short_url = filteredDocs[0].short_url;
    } else {
      short_url = await getNextCounter("short_url");
      await db
        .collection(collectionName)
        .insertOne({ original_url: url, short_url });
    }
    res.json({
      original_url: url,
      short_url: short_url,
    });
  } catch (error) {
    res.json({ error: "invalid url" });
  }
});

app.listen(port, async function () {
  await client.connect();
  console.log("Connected successfully to server");
  console.log(`Listening on port ${port}`);
});
