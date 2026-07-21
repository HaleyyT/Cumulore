import type { Difficulty, Focus, Question, Quest } from "./types";

type QuestionVariant = {
  prompt: string;
  correct: string;
  distractors: readonly [string, string, string];
  explanation: string;
};

type QuestionSeed = {
  id: string;
  conceptIds: readonly string[];
  excerpt: string;
  variants: Record<Difficulty, QuestionVariant>;
};

const evidence = {
  retrieval:
    "Retrieval practice strengthens memory by requiring a learner to recall information before looking at the answer; familiarity while viewing the answer is not evidence of independent recall.",
  spacing:
    "Spacing distributes practice across multiple sessions, allowing some forgetting before effortful recall.",
  interleaving:
    "Interleaving mixes related problem types so learners must identify which strategy applies instead of repeating one procedure.",
  feedback:
    "Feedback is most useful after an attempt because it can correct an error and explain the gap between the response and the target.",
  transfer:
    "Transfer occurs when a learner selects and applies knowledge in a new context rather than repeating a familiar example.",
  retrievalSpacing:
    "Combining retrieval with spacing creates repeated opportunities to reconstruct an answer after a delay instead of merely rereading it.",
  retrievalTransfer:
    "Retrieving an idea in varied situations builds more flexible access, which supports using that idea in a new context.",
  integratedPractice:
    "A durable study cycle spaces repeated retrieval attempts, checks each attempt with specific feedback, and revisits weak ideas in later sessions.",
  feedbackTransfer:
    "After feedback corrects an error, applying the corrected idea to a structurally related new case tests whether the correction became usable knowledge.",
  productiveChallenge:
    "Practice should require meaningful effort while still allowing correction; difficulty without useful feedback can reinforce confusion, so later independent performance matters more than difficulty alone.",
} as const;

const questionSeeds: Record<Focus | "rematch", readonly QuestionSeed[]> = {
  foundation: [
    {
      id: "retrieval-foundation",
      conceptIds: ["concept-retrieval"],
      excerpt: evidence.retrieval,
      variants: {
        easy: {
          prompt:
            "Which action is an example of retrieval practice after reading a definition?",
          correct: "Close the notes and explain the definition from memory",
          distractors: [
            "Copy the definition while looking at it",
            "Highlight the definition a second time",
            "Keep the definition visible while repeating it",
          ],
          explanation:
            "Explaining from memory requires recall before checking the source, which is the defining action in retrieval practice.",
        },
        medium: {
          prompt:
            "Why can a closed-book recall attempt strengthen memory more than another immediate reread?",
          correct:
            "It requires reconstructing the idea before seeing the answer",
          distractors: [
            "It guarantees that the first answer is correct",
            "It removes the need to check misunderstandings",
            "It makes the material visually more familiar",
          ],
          explanation:
            "The benefit comes from reconstructing the idea from memory; the learner can then compare that attempt with the source.",
        },
        hard: {
          prompt:
            "Which observation best distinguishes successful retrieval practice from an illusion of fluency?",
          correct:
            "The learner can produce the idea without the answer being visible, then verify it",
          distractors: [
            "The page feels increasingly familiar after several rereads",
            "The learner recognises the answer while it remains highlighted",
            "The material can be copied quickly with few pauses",
          ],
          explanation:
            "Independent production followed by verification demonstrates accessible recall; familiarity while viewing the answer does not.",
        },
      },
    },
    {
      id: "spacing-foundation",
      conceptIds: ["concept-spacing"],
      excerpt: evidence.spacing,
      variants: {
        easy: {
          prompt: "Which schedule uses spacing for a topic studied this week?",
          correct: "Three shorter sessions on different days",
          distractors: [
            "Three sessions back-to-back tonight",
            "One long session followed by no review",
            "One session with three copies of the same notes",
          ],
          explanation:
            "Sessions on different days distribute practice and create delayed recall opportunities.",
        },
        medium: {
          prompt:
            "What useful change does a delay between study sessions create?",
          correct: "Some forgetting makes the next retrieval more effortful",
          distractors: [
            "The delay removes the need to retrieve anything",
            "The delay guarantees permanent memory without review",
            "The delay turns every later question into recognition",
          ],
          explanation:
            "A bounded delay permits some forgetting, so the next session requires reconstruction rather than immediate repetition.",
        },
        hard: {
          prompt:
            "A learner spaces sessions but passively rereads each time. Which qualification is most accurate?",
          correct:
            "The schedule is distributed, but adding effortful recall would better use each session",
          distractors: [
            "Spacing has failed because every session must occur on one day",
            "Rereading makes the delays irrelevant in every circumstance",
            "The schedule already guarantees transfer to unfamiliar problems",
          ],
          explanation:
            "The timing satisfies spacing, but the activity can still be improved by requiring recall and verification within each session.",
        },
      },
    },
    {
      id: "interleaving-foundation",
      conceptIds: ["concept-interleaving"],
      excerpt: evidence.interleaving,
      variants: {
        easy: {
          prompt: "Which practice set is interleaved?",
          correct:
            "A mixed set of related problems that need different methods",
          distractors: [
            "Twenty copies of one solved example",
            "One problem type repeated in a fixed block",
            "A set with the correct method printed above every question",
          ],
          explanation:
            "A mixed set requires the learner to identify the relevant method instead of repeating a single procedure.",
        },
        medium: {
          prompt:
            "Why can interleaving feel harder than blocked practice even when it improves learning?",
          correct: "The learner must choose a strategy before applying it",
          distractors: [
            "The learner receives the strategy with every question",
            "The learner never encounters related examples",
            "The learner avoids comparing problem types",
          ],
          explanation:
            "Interleaving adds a discrimination step: recognising what kind of problem is present and selecting an appropriate strategy.",
        },
        hard: {
          prompt:
            "When would mixing exercises fail to provide the intended benefit of interleaving?",
          correct:
            "When each exercise labels the required method, so no strategy choice is needed",
          distractors: [
            "When related problem types appear in an unpredictable order",
            "When learners compare why two methods fit different cases",
            "When the set requires choosing among plausible strategies",
          ],
          explanation:
            "Merely changing order is insufficient if labels remove the need to discriminate between problem types and select a method.",
        },
      },
    },
    {
      id: "feedback-foundation",
      conceptIds: ["concept-feedback"],
      excerpt: evidence.feedback,
      variants: {
        easy: {
          prompt: "When is corrective feedback most useful during practice?",
          correct: "After the learner has attempted an answer",
          distractors: [
            "Instead of allowing any attempt",
            "Only after the final exam",
            "Before the learner sees the question",
          ],
          explanation:
            "An attempt gives feedback something concrete to diagnose and correct.",
        },
        medium: {
          prompt:
            "Which feedback is most likely to improve the learner's next attempt?",
          correct:
            "It identifies the error and explains how the target answer differs",
          distractors: [
            "It displays only a score with no explanation",
            "It says the answer is wrong but hides the target",
            "It praises effort without addressing the response",
          ],
          explanation:
            "Actionable feedback connects the specific response to the target and makes a correction possible.",
        },
        hard: {
          prompt:
            "Which feedback policy best balances productive effort with error correction?",
          correct:
            "Require an attempt, then give timely, specific guidance and another opportunity",
          distractors: [
            "Reveal every answer before an attempt can occur",
            "Delay all correction until misconceptions are well rehearsed",
            "Report confidence only and never compare with the target",
          ],
          explanation:
            "The sequence preserves retrieval effort while preventing an uncorrected error from becoming the learner's final representation.",
        },
      },
    },
  ],
  connection: [
    {
      id: "retrieval-spacing-connection",
      conceptIds: ["concept-retrieval", "concept-spacing"],
      excerpt: evidence.retrievalSpacing,
      variants: {
        easy: {
          prompt: "Which plan combines retrieval practice with spacing?",
          correct:
            "Recall the topic from memory in several sessions across the week",
          distractors: [
            "Reread the topic repeatedly in one sitting",
            "Copy the topic once and avoid later review",
            "Keep the answer visible during one long session",
          ],
          explanation:
            "The plan uses both independent recall and sessions separated in time.",
        },
        medium: {
          prompt:
            "Why does combining retrieval with spacing provide more than either passive delay or immediate repetition?",
          correct:
            "Each delayed session requires the learner to reconstruct the answer again",
          distractors: [
            "The delay ensures the answer never becomes difficult to recall",
            "Immediate repetition removes the need for later access",
            "The combination keeps every answer continuously visible",
          ],
          explanation:
            "Spacing creates the delay, and retrieval turns each return into an effortful reconstruction that can be checked.",
        },
        hard: {
          prompt:
            "A spaced plan produces little improvement. Which diagnosis best follows from the retrieval-spacing relationship?",
          correct:
            "Check whether each session required unaided recall rather than another exposure",
          distractors: [
            "Move every session onto the same day to increase spacing",
            "Remove answer checking so errors cannot interrupt fluency",
            "Replace all delayed practice with highlighted summaries",
          ],
          explanation:
            "A calendar can be spaced while the activity remains passive; the missing mechanism may be reconstruction from memory.",
        },
      },
    },
    {
      id: "interleaving-choice-connection",
      conceptIds: ["concept-interleaving"],
      excerpt: evidence.interleaving,
      variants: {
        easy: {
          prompt:
            "What skill does an interleaved problem set add before solving?",
          correct: "Choosing which method fits the problem",
          distractors: [
            "Copying the method named in the heading",
            "Repeating the previous answer automatically",
            "Avoiding comparison between problem types",
          ],
          explanation:
            "Mixed related problems require a method choice before execution.",
        },
        medium: {
          prompt:
            "How does interleaving connect comparison with strategy selection?",
          correct:
            "Contrasting related cases reveals cues that indicate which strategy fits",
          distractors: [
            "It makes all related cases require exactly the same strategy",
            "It removes the need to inspect the problem's features",
            "It rewards using the most recently practised method every time",
          ],
          explanation:
            "Comparison helps learners notice discriminating features, which then guide strategy selection.",
        },
        hard: {
          prompt:
            "Learners solve each blocked set accurately but choose the wrong method on a mixed test. What is the strongest diagnosis?",
          correct:
            "They practised executing methods without sufficiently practising method selection",
          distractors: [
            "They should label the method above every mixed-test question",
            "They need longer blocks containing only the already-mastered method",
            "They should avoid comparing similar-looking problem types",
          ],
          explanation:
            "Blocked accuracy can show procedural execution while hiding a weakness in discriminating when each procedure applies.",
        },
      },
    },
    {
      id: "attempt-feedback-connection",
      conceptIds: ["concept-retrieval", "concept-feedback"],
      excerpt: evidence.feedback,
      variants: {
        easy: {
          prompt: "Which sequence connects retrieval and feedback?",
          correct:
            "Attempt from memory, compare with the target, then correct the answer",
          distractors: [
            "Read the target first and skip the attempt",
            "Attempt once and never check the result",
            "Copy an answer and treat it as recalled",
          ],
          explanation:
            "The sequence preserves a genuine recall attempt and then uses feedback to correct it.",
        },
        medium: {
          prompt:
            "What role does feedback play after an effortful but incorrect retrieval?",
          correct:
            "It prevents the error from remaining the learner's unchallenged answer",
          distractors: [
            "It proves that retrieval should never be attempted again",
            "It converts the incorrect response into a correct memory automatically",
            "It makes the original attempt unnecessary in every later session",
          ],
          explanation:
            "Retrieval exposes the current representation; timely feedback then identifies and repairs the discrepancy.",
        },
        hard: {
          prompt:
            "A quiz maximises effort but withholds all answer information. Which system-level risk does this create?",
          correct:
            "Confident errors may be repeatedly retrieved without a correction signal",
          distractors: [
            "Learners will receive too much explanation before attempting",
            "Every correct response will become impossible to retrieve later",
            "Spacing will collapse because the questions have answer choices",
          ],
          explanation:
            "Effort is not sufficient by itself: a correction boundary is needed when retrieval produces a misconception.",
        },
      },
    },
    {
      id: "retrieval-transfer-connection",
      conceptIds: ["concept-retrieval", "concept-transfer"],
      excerpt: evidence.retrievalTransfer,
      variants: {
        easy: {
          prompt: "Which practice is most likely to support transfer?",
          correct:
            "Recall the same principle while solving several varied examples",
          distractors: [
            "Memorise one example's surface wording",
            "Repeat one answer without checking its meaning",
            "Avoid using the principle outside the original example",
          ],
          explanation:
            "Retrieving the principle across varied situations practises access beyond one familiar cue.",
        },
        medium: {
          prompt:
            "Why can varied retrieval improve access to an idea in a new context?",
          correct:
            "The idea becomes connected to more than the cues from one example",
          distractors: [
            "Variation guarantees that every new problem is identical",
            "The learner no longer needs to recognise relevant features",
            "The original idea can be replaced by memorised surface details",
          ],
          explanation:
            "Varied contexts require the learner to reconstruct the idea from different cues, supporting more flexible access.",
        },
        hard: {
          prompt:
            "A learner recalls a rule perfectly when shown the textbook diagram but not in a novel case. What should practice target?",
          correct:
            "Retrieving and applying the rule from varied cues and representations",
          distractors: [
            "Increasing repetition of only the original diagram",
            "Removing all novel cases until after assessment",
            "Memorising the diagram's colours more precisely",
          ],
          explanation:
            "The recall appears tied to one representation; varied cues can strengthen access to the underlying rule rather than its surface form.",
        },
      },
    },
  ],
  synthesis: [
    {
      id: "weekly-plan-synthesis",
      conceptIds: ["concept-retrieval", "concept-spacing", "concept-feedback"],
      excerpt: evidence.integratedPractice,
      variants: {
        easy: {
          prompt:
            "Which weekly plan best applies retrieval, spacing, and feedback?",
          correct:
            "Use short closed-book quizzes on three days and check each answer",
          distractors: [
            "Reread for one long session and never check recall",
            "Copy the notes on three days with every answer visible",
            "Take one quiz and ignore every incorrect response",
          ],
          explanation:
            "The plan distributes practice, requires recall, and includes a correction step.",
        },
        medium: {
          prompt:
            "A learner has three study sessions before an exam. Which multistep design best supports durable recall?",
          correct:
            "Retrieve on each day, inspect feedback, and revisit missed ideas in the next session",
          distractors: [
            "Use the first two sessions for passive rereading and skip the third",
            "Reveal every answer before each question to prevent effort",
            "Repeat only already-correct answers and hide all errors",
          ],
          explanation:
            "The design combines delayed reconstruction, error correction, and targeted return to weak material.",
        },
        hard: {
          prompt:
            "Which revision policy best preserves retrieval evidence while adapting later spaced sessions?",
          correct:
            "Record unaided attempts, correct them, then prioritise weak concepts without dropping successful retrievals entirely",
          distractors: [
            "Use confidence alone to remove all concepts from later sessions",
            "Show answers during every attempt so accuracy remains high",
            "Repeat only failures immediately until their wording feels familiar",
          ],
          explanation:
            "The policy uses actual retrieval outcomes, closes errors with feedback, and adapts future spacing without assuming one success is permanent mastery.",
        },
      },
    },
    {
      id: "fluency-diagnosis-synthesis",
      conceptIds: ["concept-retrieval", "concept-feedback"],
      excerpt: evidence.retrieval,
      variants: {
        easy: {
          prompt:
            "Notes feel familiar, but the learner cannot explain them unaided. What should they do next?",
          correct:
            "Attempt an explanation from memory, then check it against the notes",
          distractors: [
            "Reread until the page feels even more familiar",
            "Copy the page without pausing to recall",
            "Assume familiarity proves the idea can be produced",
          ],
          explanation:
            "An unaided explanation tests retrieval, and checking it supplies the feedback that familiarity cannot.",
        },
        medium: {
          prompt:
            "A learner recognises every highlighted term but omits key steps in a blank-page explanation. What is the best inference?",
          correct: "Recognition fluency is masking incomplete retrieval",
          distractors: [
            "The blank-page task proves feedback is unnecessary",
            "Highlight recognition guarantees the omitted steps are mastered",
            "The learner should remove all future recall attempts",
          ],
          explanation:
            "Recognition with cues and production without cues are different demands; the blank-page omissions reveal the retrieval gap.",
        },
        hard: {
          prompt:
            "Which evidence would most strongly overturn the claim that repeated rereading produced transferable mastery?",
          correct:
            "Accurate recognition paired with failed explanation and application in altered contexts",
          distractors: [
            "Increasing speed while rereading the unchanged page",
            "High confidence while the original example remains visible",
            "Accurate copying of the source's sentence structure",
          ],
          explanation:
            "Failure under independent production and changed cues shows that familiarity with the original display did not become flexible knowledge.",
        },
      },
    },
    {
      id: "novel-problem-synthesis",
      conceptIds: ["concept-interleaving", "concept-transfer"],
      excerpt: evidence.transfer,
      variants: {
        easy: {
          prompt:
            "A new problem looks different from practice examples. What should the learner identify first?",
          correct: "The underlying principle and which practised strategy fits",
          distractors: [
            "The example with the most similar colours",
            "The most recently memorised answer wording",
            "A strategy chosen without inspecting the problem",
          ],
          explanation:
            "Transfer requires recognising the underlying structure and selecting a fitting strategy despite changed surface details.",
        },
        medium: {
          prompt:
            "How should practice prepare a learner to solve an unfamiliar case without naming the required method?",
          correct:
            "Mix related cases and require the learner to justify the strategy choice",
          distractors: [
            "Block every method and label it above each problem",
            "Memorise one solved case without comparing alternatives",
            "Remove cases whose surface details differ from the example",
          ],
          explanation:
            "Mixed cases practise discrimination, while justification checks whether the chosen method follows from structural cues.",
        },
        hard: {
          prompt:
            "Which assessment provides the strongest evidence that interleaved practice produced transfer rather than memorised selection cues?",
          correct:
            "Learners justify an appropriate method on structurally related cases with unfamiliar surface features",
          distractors: [
            "Learners repeat the last blocked procedure on identical examples",
            "Learners select a method after its name is supplied",
            "Learners recognise previously memorised answer sentences",
          ],
          explanation:
            "Novel surface features remove memorised display cues, and a justified method choice demonstrates discrimination based on structure.",
        },
      },
    },
    {
      id: "productive-challenge-synthesis",
      conceptIds: ["concept-feedback", "concept-transfer"],
      excerpt: evidence.productiveChallenge,
      variants: {
        easy: {
          prompt:
            "A practice set is so difficult that errors never receive explanations. What should change?",
          correct:
            "Add useful feedback and adjust challenge so correction is possible",
          distractors: [
            "Keep every error unexplained to maximise struggle",
            "Reveal all answers before learners attempt",
            "Remove every question that requires thought",
          ],
          explanation:
            "Useful challenge still needs a path to correction; otherwise effort can rehearse confusion.",
        },
        medium: {
          prompt:
            "Which result suggests that a 'desirable difficulty' has become unproductive?",
          correct:
            "Errors repeat because learners receive no information that supports correction",
          distractors: [
            "Learners need effort before producing a correct response",
            "Learners compare an attempted answer with the target",
            "Learners revisit a corrected idea after a delay",
          ],
          explanation:
            "Effort supports learning only when the system allows learners to detect, understand, and repair errors.",
        },
        hard: {
          prompt:
            "A team wants maximum task difficulty as a proxy for learning. Which evaluation is most defensible?",
          correct:
            "Measure later independent performance and error correction, not difficulty alone",
          distractors: [
            "Treat the highest immediate error rate as proof of transfer",
            "Ignore whether feedback changes later responses",
            "Prefer tasks that prevent any successful retrieval",
          ],
          explanation:
            "Difficulty is a design input, not evidence of learning; later retrieval, transfer, and corrected errors provide stronger outcome evidence.",
        },
      },
    },
  ],
  rematch: [
    {
      id: "retrieval-rematch",
      conceptIds: ["concept-retrieval"],
      excerpt: evidence.retrieval,
      variants: {
        easy: {
          prompt: "Which quick check directly tests retrieval?",
          correct: "Write the key idea before reopening the notes",
          distractors: [
            "Count how many times the notes were read",
            "Copy the key idea while viewing it",
            "Judge how familiar the page looks",
          ],
          explanation:
            "Writing before reopening the notes measures what can be produced without the answer visible.",
        },
        medium: {
          prompt:
            "What should happen immediately after an unaided retrieval attempt?",
          correct:
            "Compare it with the source and correct missing or inaccurate parts",
          distractors: [
            "Delete the attempt before checking it",
            "Assume confidence makes verification unnecessary",
            "Replace the source with the attempted answer",
          ],
          explanation:
            "Verification turns the attempt into evidence and closes any gap between memory and the source.",
        },
        hard: {
          prompt:
            "Which measure is the least valid proxy for independent retrieval?",
          correct:
            "A rating of familiarity while the complete answer is visible",
          distractors: [
            "A delayed explanation written without notes",
            "A response produced before answer options appear",
            "A recalled principle verified against the source",
          ],
          explanation:
            "Familiarity under full cues does not establish that the learner can produce the idea independently.",
        },
      },
    },
    {
      id: "spacing-rematch",
      conceptIds: ["concept-spacing"],
      excerpt: evidence.spacing,
      variants: {
        easy: {
          prompt: "Which calendar change creates spacing?",
          correct: "Move two reviews to later days",
          distractors: [
            "Place every review in the next ten minutes",
            "Lengthen one session and cancel all others",
            "Repeat one answer without a break",
          ],
          explanation:
            "Later days distribute practice and introduce a delay before retrieval.",
        },
        medium: {
          prompt: "Why should a spaced review still contain an active task?",
          correct:
            "Time distribution does not by itself require the learner to retrieve",
          distractors: [
            "Any delay automatically verifies every answer",
            "Active recall prevents sessions from being distributed",
            "A calendar alone diagnoses misconceptions",
          ],
          explanation:
            "Spacing describes when practice occurs; the task within each session determines whether recall is exercised.",
        },
        hard: {
          prompt:
            "Which change best improves a spaced schedule that repeatedly produces effortless recognition?",
          correct:
            "Use delayed prompts that remove the answer cues before checking",
          distractors: [
            "Keep answers visible and shorten every delay",
            "Replace later sessions with one immediate reread",
            "Remove verification after every response",
          ],
          explanation:
            "Removing cues makes each delayed session test reconstruction rather than familiarity.",
        },
      },
    },
    {
      id: "interleaving-rematch",
      conceptIds: ["concept-interleaving"],
      excerpt: evidence.interleaving,
      variants: {
        easy: {
          prompt: "What makes a mixed practice set useful?",
          correct: "Learners must decide which method matches each problem",
          distractors: [
            "Every problem announces the method",
            "Only one problem type ever appears",
            "The previous answer can be reused unchanged",
          ],
          explanation:
            "The selection decision is the key additional practice created by interleaving.",
        },
        medium: {
          prompt: "What should learners compare in an interleaved set?",
          correct: "Features that determine why different strategies apply",
          distractors: [
            "Only the order in which answers were printed",
            "Unrelated decorative details in each question",
            "Which strategy was used most recently",
          ],
          explanation:
            "Comparing discriminating features helps connect problem structure to strategy selection.",
        },
        hard: {
          prompt:
            "Which modification would strengthen a weak interleaving exercise?",
          correct:
            "Remove method labels and ask learners to justify their choices",
          distractors: [
            "Group every item by method and print its name",
            "Give the strategy before the problem is inspected",
            "Replace related contrasts with identical repetitions",
          ],
          explanation:
            "Removing labels restores the discrimination task, and justification exposes whether the choice follows from relevant cues.",
        },
      },
    },
    {
      id: "feedback-transfer-rematch",
      conceptIds: ["concept-feedback", "concept-transfer"],
      excerpt: evidence.feedbackTransfer,
      variants: {
        easy: {
          prompt: "After correcting an error, what best checks transfer?",
          correct: "Apply the corrected idea to a different example",
          distractors: [
            "Copy the correction without using it",
            "Repeat only the original answer wording",
            "Avoid all examples with new details",
          ],
          explanation:
            "A different example checks whether the corrected idea can guide performance beyond the original case.",
        },
        medium: {
          prompt: "Why should feedback be followed by a new application?",
          correct: "It tests whether the correction became usable knowledge",
          distractors: [
            "It guarantees every future context is identical",
            "It removes the need to understand the correction",
            "It turns feedback into passive recognition only",
          ],
          explanation:
            "Successful application provides stronger evidence than recognising the correction while it is displayed.",
        },
        hard: {
          prompt:
            "Which outcome best shows that corrective feedback transferred?",
          correct:
            "The learner avoids the same misconception in a structurally related novel case",
          distractors: [
            "The learner memorises the wording of the original correction",
            "The learner recognises the old answer while it is displayed",
            "The learner repeats the error when surface details change",
          ],
          explanation:
            "Avoiding the misconception under changed surface cues shows that the correction affected the underlying representation.",
        },
      },
    },
  ],
};

function question(seed: QuestionSeed, difficulty: Difficulty): Question {
  const variant = seed.variants[difficulty];
  return {
    id: `question-${seed.id}-${difficulty}`,
    conceptIds: seed.conceptIds,
    prompt: variant.prompt,
    correctId: `question-${seed.id}-${difficulty}-correct`,
    options: [
      {
        id: `question-${seed.id}-${difficulty}-correct`,
        text: variant.correct,
      },
      ...variant.distractors.map((text, index) => ({
        id: `question-${seed.id}-${difficulty}-distractor-${index + 1}`,
        text,
      })),
    ],
    explanation: variant.explanation,
    excerpt: seed.excerpt,
  };
}

const stageMisconceptions: Record<Focus, string> = {
  foundation:
    "Familiarity can feel like mastery even when independent recall is weak.",
  connection:
    "Learning strategies reinforce one another rather than operate as isolated tricks.",
  synthesis:
    "Success on a familiar drill does not guarantee transfer to a changed context.",
};

function stage(focus: Focus, difficulty: Difficulty) {
  return {
    id: `stage-${focus}-${difficulty}`,
    focus,
    misconception: stageMisconceptions[focus],
    questions: questionSeeds[focus].map((seed) => question(seed, difficulty)),
  };
}

export function scienceQuest(difficulty: Difficulty): Quest {
  return {
    title: "Science of Learning",
    difficulty,
    concepts: [
      {
        id: "concept-retrieval",
        title: "Retrieval practice",
        reason: "Reconstruct knowledge before checking the source",
      },
      {
        id: "concept-spacing",
        title: "Spacing",
        reason: "Return to ideas after a useful delay",
      },
      {
        id: "concept-interleaving",
        title: "Interleaving",
        reason: "Practise selecting among related strategies",
      },
      {
        id: "concept-feedback",
        title: "Feedback",
        reason: "Turn attempted answers into specific corrections",
      },
      {
        id: "concept-transfer",
        title: "Transfer",
        reason: "Use knowledge under changed cues and contexts",
      },
    ],
    stages: [
      stage("foundation", difficulty),
      stage("connection", difficulty),
      stage("synthesis", difficulty),
    ],
    rematch: questionSeeds.rematch.map((seed) => question(seed, difficulty)),
    takeaways: [
      {
        id: "takeaway-retrieval",
        conceptIds: ["concept-retrieval"],
        text: "Attempt retrieval before reopening the source, then verify the result.",
        excerpts: [evidence.retrieval],
      },
      {
        id: "takeaway-spacing",
        conceptIds: ["concept-spacing", "concept-retrieval"],
        text: "Distribute active recall across sessions instead of repeating one passive exposure.",
        excerpts: [evidence.retrievalSpacing],
      },
      {
        id: "takeaway-transfer",
        conceptIds: ["concept-interleaving", "concept-transfer"],
        text: "Practise choosing and applying ideas under varied cues, not only familiar examples.",
        excerpts: [evidence.transfer],
      },
      {
        id: "takeaway-feedback",
        conceptIds: ["concept-feedback"],
        text: "Use specific feedback after an attempt and apply the correction again.",
        excerpts: [evidence.feedback],
      },
    ],
  };
}
