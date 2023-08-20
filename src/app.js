import express, { json } from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs"

const app = express()

app.use(cors())
app.use(json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
  await mongoClient.connect()
  console.log("MongoDB connected.")
} catch (err) {
  (error) => console.log(error.message)
}

const db = mongoClient.db()

const participantSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
	to: joi.string().required(),
	text: joi.string().required(),
	type: joi.string().valid("message", "private_message").required()
})

app.post("/participants", async (request, response) => {
  const { name } = request.body

  const validationParticipant = participantSchema.validate( request.body, { abortEarly: false } )

  if (validationParticipant.error) {
    const errors = validationParticipant.error.details.map(detail => detail.message)
    return response.status(422).send(errors)
  }

  try {
    const participantExists = await db.collection("participants").findOne( { name } )
    if (participantExists) return response.status(409).send("Este nome de usuário já existe!")

    await db.collection("participants").insertOne( { name, lastStatus: Date.now() } )
    await db.collection("messages").insertOne( {
		from: name,
		to: "Todos",
		text: "entra na sala...",
		type: "status",
		time: dayjs().format("HH:mm:ss")
	} )

    response.sendStatus(201)
  } catch (error) { response.status(500).send(error.message) }
})

app.get("/participants", async (request, response) => {

	try {
		const activeParticipants = await db.collection("participants").find().toArray()

		if (!activeParticipants) {return response.status(404).send(activeParticipants)}

		response.send(activeParticipants)

	} catch (error) {response.status(500).send(error.message)}
})

app.post("/messages", async (request, response) => {
	const { to, text, type } = request.body
	const { user } = request.headers

	const validationMessage = messageSchema.validate( request.body, { abortEarly: false } )

	if (validationMessage.error) {
		const errors = validationMessage.error.details.map(detail => detail.message)
		return response.status(422).send(errors)
	}

	try {
		const IsParticipantActive = await db.collection("participants").findOne( { name: user } )

		if (!IsParticipantActive || IsParticipantActive.name !== user) { return response.sendStatus(422) }

		await db.collection("messages").insertOne( {
			from: user,
			to,
			text,
			type,
			time: dayjs().format("HH:mm:ss")
		} )
		response.sendStatus(201)

	} catch (error) { response.status(500).send(error.message) }
	
})

app.get("/messages", async (request, response) => {
	const { user } = request.headers
	const { limit } = request.query

	let isLimitValid

	(limit <= 0 || (isNaN(limit) === true)) ? isLimitValid = false : isLimitValid = true

	try {
		const messagesForUser = await db.collection("messages").find({ $or: [
			 { type: "message" },
			 {to: "Todos"},
			 { to: user },
			 {from: user }
			]
		}).toArray()

		if (isLimitValid === false) { return response.sendStatus(422) }

		if (!limit) { return response.send(messagesForUser) }

		if (limit && isLimitValid === true) {
			const FilteredMessagesByLimit = messagesForUser.slice(-parseInt(limit)).reverse()

			response.send(FilteredMessagesByLimit)
		}

	} catch (error) {response.status(500).send(error.message) }
})

// app.get("/messages", async (request, response) => {
// 	const { user } = request.headers
// 	const limit = parseInt(request.query.limit)

// 	try {
// 		const messagesForUser = await db.collection("messages").find({ $or: [ { type: "message" }, { to: user }, {from: user }, {to: "Todos"} ] })

// 		switch (limit) {
// 			case !limit:
// 				response.send(messagesForUser)
// 				break
// 			case limit > 0:
// 				const limitedMessages = messagesForUser.slice((limit))
// 				response.send(limitedMessages)
// 				break
// 			case limit <= 0:
// 				response.sendStatus(422)
// 				break
// 		};
// 	}  catch (error) {response.status(500).send(error.message)};
// })

app.post("/status", async (request, response) => {
	const { user } = request.headers

	try {
		const IsParticipantActive = await db.collection("participants").findOne( { name: user } )

		if (!user || user === undefined || !IsParticipantActive) { return response.sendStatus(404) }

		await db.collection("participants").updateOne( { name: user }, { $set: { lastStatus: Date.now() } } )
		response.sendStatus(200)

	} catch (error) { response.status(500).send(error.message) }
})

async function removeInactiveParticipants() {
	const currentTime = Date.now()
	const inactivityTimeLimit = currentTime - 100000
	
	try {
		const inactiveParticipants = await db.collection("participants").find( { lastStatus: { $lt: inactivityTimeLimit } } ).toArray()

		console.log(inactiveParticipants)
		
	} catch (error) {res.status(500).send(error.message)}
}


// function removeInactiveParticipants() {
// 	const currentTime = Date.now()
// 	const inactiveTimeLimit = currentTime - 10000
  
// 	const inactiveParticipants = await db.collection("participants").find({ lastStatus: { $lt: inactiveTimeLimit } })

// 	Participants.remove({ _id: { $in: inactiveParticipants.map(participant => participant._id) } })

// 	inactiveParticipants.forEach(participant => {
// 	  const message = {from: participant.name, to, text: "sai da sala...", type, time: dayjs().format("HH:mm:ss")}

// 		await db.collection("messages").insertOne(message)
// 	  } catch (error) {res.status(500).send(error.message)}
// 	})
// }

// setInterval(removeInactiveParticipants, 5000)

const PORT = 5000
app.listen(PORT, () => console.log(`Server active on port ${PORT}.`))
