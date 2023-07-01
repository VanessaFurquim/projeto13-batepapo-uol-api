import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(cors());
app.use(json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  console.log("MongoDB connect.");
} catch (err) {
  (err) => console.log(err.message);
}

const db = mongoClient.db();

const timeStamp = dayjs();
/* const date = Date.now(); */

app.post("/participants", async (req, res) => {
  const { name } = req.body; /* recebendo objeto do cliente */
  const time = timeStamp.format("HH:mm:ss");

  const schemaParticipants = joi.object({
    name: joi.string().required()
  });

  const schemaMessages = joi.object({
    from: joi.string(name).required(),
    to: joi.string("Todos").required(),
    text: joi.string("entra na sala...").required(),
    type: joi.string("status").required(),
    time: joi.string(time).required()
  });
  /* formato dos objetos para validação */

  const validationParticipant = schemaParticipants.validate(req.body, {abortEarly: false});

  if (validationParticipant.error) {
    const errors = validationParticipant.error.details.map((detail) => detail.message); /* tratamento da validação participants */
    console.log(errors);
    return res.sendStatus(422);
  }

  const validationMessages = schemaMessages.validate(req.body, {abortEarly: false});

  console.log(validationMessages)

  if (validationMessages.error) {
    const errors = validationMessages.error.details.map((detail) => detail.message); /* tratamento da validação messages */
    console.log(errors);
    return res.sendStatus(422);
  }

  try {
    const participant = await db.collection("participants").findOne({ name: name });
    if (participant) return res.sendStatus(409);

    await db.collection("participants").insertOne({ name: name /* lastStatus: Date.now() */ });
    await db.collection("messages").insertOne({});

    res.sendStatus(201); /* enviando resposta para o cliente */
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server active on port ${PORT}.`));
