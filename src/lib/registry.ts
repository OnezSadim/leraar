import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

// Define the generic AI Tool structure
export interface AITool<T extends z.ZodTypeAny = any> {
    name: string;
    description: string;
    parameters: T;
    execute: (userId: string, args: z.infer<T>) => Promise<any>;
}

// Global registry of all available tools
const AGENT_REGISTRY = new Map<string, AITool>();

/**
 * Register a new tool so the AI can discover and use it dynamically.
 */
export function registerTool<T extends z.ZodTypeAny>(tool: AITool<T>) {
    AGENT_REGISTRY.set(tool.name, tool);
}

/**
 * Get all registered tools as Gemini FunctionDeclarations.
 */
export function getGeminiTools(): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];

    for (const tool of AGENT_REGISTRY.values()) {
        // Convert Zod schema to JSON schema
        const jsonSchema: any = zodToJsonSchema(tool.parameters, { target: "jsonSchema7" });

        // Ensure type compatibility with Gemini's SchemaType
        // Gemini strictly requires "type: SchemaType.OBJECT" at the root for parameters.
        const parameters = {
            type: SchemaType.OBJECT,
            properties: jsonSchema.properties || {},
            required: jsonSchema.required || [],
        };

        // Recursively convert 'type' strings to SchemaType enums if needed
        const fixTypes = (obj: any) => {
            if (obj && typeof obj === 'object') {
                if (obj.type && typeof obj.type === 'string') {
                    obj.type = obj.type.toUpperCase() as SchemaType;
                }
                for (const key in obj) {
                    fixTypes(obj[key]);
                }
            }
        };
        fixTypes(parameters.properties);

        declarations.push({
            name: tool.name,
            description: tool.description,
            parameters,
        });
    }

    return declarations;
}

/**
 * Execute a tool by name with the given arguments.
 */
export async function executeTool(userId: string, name: string, args: any) {
    const tool = AGENT_REGISTRY.get(name);
    if (!tool) {
        throw new Error(`Tool ${name} not found in the registry.`);
    }

    // Validate arguments with Zod before executing
    const parsedArgs = tool.parameters.parse(args);
    return await tool.execute(userId, parsedArgs);
}

// ==============================================
// INTERNAL TOOLS (Migrated from agent-registry)
// ==============================================
// We will populate this next.
