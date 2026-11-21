const { z } = require("zod");
const { generateAnswer } = require("./gemini");

const planSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  steps: z.array(
    z.object({
      title: z.string().trim().min(1).max(200),
      action: z.string().trim().min(1).max(1000),
    })
  ).min(1).max(5),
});

async function generateStudyPlan(results) {
  const answer = await generateAnswer(
    "Create a personal study plan using the latest quiz scores supplied. " +
    "Prioritize modules with lower score percentages. " +
    "For low scores recommend lesson review, flashcards and quiz practice. " +
    "For strong scores recommend revision and continued learning. " +
    "Do not infer specific misunderstood topics from overall scores. " +
    "Do not invent lessons, scores or weaknesses. " +
    "Return only JSON without Markdown fences: " +
    '{"summary":"text","steps":[{"title":"text","action":"text"}]}',
    [{
      lecture_title: "Student quiz results",
      content: JSON.stringify(results),
    }]
  );

  const json = answer.trim()
    .replace(/^(?:json)?\s*/i, "")
    .replace(/\s*$/, "");

  return planSchema.parse(JSON.parse(json));
}

module.exports = { generateStudyPlan };