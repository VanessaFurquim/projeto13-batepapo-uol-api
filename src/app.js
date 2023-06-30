import express, { json } from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import joi from 'joi'


const app = express()

app.use(cors())
app.use(json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
	await mongoClient.connect()
	console.log("MongoDB connect.")
}
catch (err) {(err) => console.log(err.message)}

const db = mongoClient.db()

const PORT = 5000;
app.listen(PORT, () => console.log(`Server active on port ${PORT}.`));