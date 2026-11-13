export interface Food { id: number; x: number; y: number }
export interface Cell { id: number; sex?: "male" | "female"; x: number; y: number; direction: number; velocity: number; turnIn: number; avoidUntil?: number; target: number | null; eaten: number; alive: boolean; flash: number }
export interface World { schema: 1; contacts?: Record<string, [number, number]>; seed: number; cells: Cell[]; foods: Food[]; nextFood: number; t: number; debt: number; running: boolean; speed: number; rate: number; wall: number; revision: number; generation: number }
export interface Env { WORLD: DurableObjectNamespace; ALLOWED_ORIGINS: string }
