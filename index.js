require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const dns = require("node:dns");
const dnsPromises = dns.promises;
const { MongoClient } = require("mongodb");

// Basic Configuration
const port = process.env.PORT || 3000;

const url =
  "mongodb+srv://ddungca:password123!A@cluster0.ayhibtm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
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
    await dnsPromises
      .lookup(url.split(":")[1].replace("//", ""), {})
      .catch((err) => {
        throw 400;
      });
    console.log(url.split(":")[1].replace("//", ""));
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
    res.json({ original_url: url, short_url: short_url });
  } catch (error) {
    res.json({ error: "invalid url" });
  }
});

app.get("/api/shorturl/:short", async (req, res, next) => {
  const short_url = Number(req.params.short);
  if (isNaN(short_url)) {
    res.json({ error: "invalid url" });
  }
  const original_url = await db
    .collection(collectionName)
    .findOne({ short_url });
  if (!!original_url) {
    res.redirect(original_url.original_url);
  }
});

app.listen(port, async function () {
  await client.connect();
  console.log("Connected successfully to server");
  console.log(`Listening on port ${port}`);
});
