// Typed questions, the way TypeSafe's classifier (Jev) takes them: every answer is
// a choice, a score or a yes/no, and each comes with how sure it is.

export type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } };

export type Answer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; confidence: number }
  | { type: "noul"; noul: number };

export type Questions = Record<string, Question>;
export type Answers = Record<string, Answer>;

export interface AskOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Something that answers typed questions. */
export interface Classifier {
  ask(state: unknown, questions: Questions, opts?: AskOptions): Promise<Answers>;
}
