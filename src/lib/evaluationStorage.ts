import type {EvaluationResult} from "./evaluationEngine";
const KEY="breachx-latest-evaluation";
export function writeEvaluation(result:EvaluationResult){localStorage.setItem(KEY,JSON.stringify(result));}
export function readEvaluation():EvaluationResult|null{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as EvaluationResult:null;}catch{return null;}}
