const { z } = require("zod");
const { generateAnswer } = require("./gemini");

const materialSchema = z.object({
  summary: z.string().trim().min(1).max(3000),
  flashcards: z.array(
    z.object({
      question: z.string().trim().min(1).max(500),
      answer: z.string().trim().min(1).max(1000),
    })
  ).min(1).max(5),
});

async function generateStudyMaterial(lesson, level = "beginner") {
  

  const instructions = {
  beginner:
    "Explain in simple words. Define basic terms using only the supplied lesson. ",
  intermediate:
    "Explain how the concepts connect and explain examples from the supplied lesson. ",
  advanced:
    "Explain technical details, reasoning and limitations supported by the supplied lesson. ",
};

const instruction =
  instructions[level] || instructions.beginner;
  const answer = await generateAnswer(
     instruction +
'Create a lesson summary and up to 5 flashcards. ' +
    'Use only the supplied lesson. Return only valid JSON: ' +
    '{"summary":"text","flashcards":' +
    '[{"question":"text","answer":"text"}]}. ' +
    'Do not use Markdown fences. Put citations inside strings.',
    [{
      lecture_title: lesson.title,
      content: lesson.transcript,
    }]
  );

  const json = answer.trim()
    .replace(/^(?:json)?\s*/i, "")
    .replace(/\s*$/, "");

  return materialSchema.parse(JSON.parse(json));
}

module.exports = { generateStudyMaterial };