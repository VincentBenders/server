import express from "express";
import { AzureChatOpenAI } from "@langchain/openai";
import cors from "cors";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

const app = express();
const model = new AzureChatOpenAI({ temperature: 0.2 });
let Allmessages = [];

app.use(cors());
app.use(express.json());

// app.post('/chat', async (req, res) => {
//     const question = req.body.q
//     const message = [
//         new SystemMessage("your a fantasy dwarf that always relate things to the mountains and the mines. you also have a very dry sense of humor and you name is Eisen. but keep it short"),
//         new HumanMessage(question)
//     ]

//     const chat1 = await model.stream(message);

//     res.setHeader("Content-Type", "text/plain");
//     for await (const chunk of chat1) {
//         await new Promise(resolve => setTimeout(resolve, 100));
//         console.log(chunk.content);
//         res.write(chunk.content);
//     }
//     res.end();
// })

app.get("/test", async (req, res) => {
  const response = await fetch("https://api.opendota.com/api/heroes", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  //   console.log(await response.json());
  res.json({
    mesage: await response.json(),
  });
});

app.post("/chat", async (req, res) => {
  const question = req.body.q;
  const context = req.body.history;
  const response = await fetch("https://api.opendota.com/api/heroes", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  Allmessages.push(["user", question]);
  const message = [
    new SystemMessage(
      "your a fantasy dwarf that always relate things to the mountains and the mines. but keep it short"
    ),
  ];

  console.log(context);

  for (const { human, ai } of context) {
    message.push(new HumanMessage(human));
    message.push(new AIMessage(ai));
  }

  // ???????? (zet AIMesage en HUmanMessage vanuit de history ook in message)

  message.push(new HumanMessage(question));

  const chat1 = await model.stream(message);

  res.setHeader("Content-Type", "text/plain");
  for await (const chunk of chat1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(chunk.content);
    res.write(chunk.content);
  }

  res.end();
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`Server is listening on port ${process.env.EXPRESS_PORT}`);
});
