/**
 * Plugin Runtime
 *
 * Responsible for safely merging installed plugin AI tool definitions
 * into the AI agent's live context. Applies strict schema validation
 * to prevent arbitrary injection via the `ai_tools` JSONB column.
 */

import { FunctionDeclaration, SchemaType, Schema } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

// ─── Whitelist Validation ─────────────────────────────────────────────────────

type AllowedType = 'string' | 'number' | 'boolean' | 'object' | 'array';
const ALLOWED_TYPES = new Set<AllowedType>([
    'string', 'number', 'boolean', 'object', 'array',
]);

interface RawAIToolDef {
    name: string;
    description: string;
    parameters?: {
        type: 'object';
        properties?: Record<string, { type: AllowedType; description?: string }>;
        required?: string[];
    };
}

/**
 * Strictly validates a raw tool definition from the database.
 * Returns null if the definition is malformed or uses disallowed fields.
 */
function validateToolDef(raw: unknown): RawAIToolDef | null {
    if (!raw || typeof raw !== 'object') return null;
    const t = raw as Record<string, unknown>;

    if (typeof t.name !== 'string' || !t.name.match(/^[a-z][a-z0-9_]{0,62}$/)) return null;
    if (typeof t.description !== 'string' || t.description.length > 500) return null;

    if (t.parameters !== undefined) {
        if (typeof t.parameters !== 'object' || t.parameters === null) return null;
        const params = t.parameters as Record<string, unknown>;
        if (params.type !== 'object') return null;

        if (params.properties !== undefined) {
            if (typeof params.properties !== 'object' || params.properties === null) return null;
            for (const [key, value] of Object.entries(params.properties as Record<string, unknown>)) {
                if (typeof key !== 'string') return null;
                if (!value || typeof value !== 'object') return null;
                const prop = value as Record<string, unknown>;
                if (!ALLOWED_TYPES.has(prop.type as AllowedType)) return null;
                if (prop.description !== undefined && typeof prop.description !== 'string') return null;
            }
        }

        if (params.required !== undefined) {
            if (!Array.isArray(params.required)) return null;
            if (!params.required.every((r) => typeof r === 'string')) return null;
        }
    }

    return raw as RawAIToolDef;
}

/**
 * Convert a validated RawAIToolDef → Gemini FunctionDeclaration.
 */
function toFunctionDeclaration(def: RawAIToolDef): FunctionDeclaration {
    const properties: Record<string, Schema> = {};

    for (const [key, prop] of Object.entries(def.parameters?.properties ?? {})) {
        properties[key] = {
            type: prop.type.toUpperCase() as SchemaType,
            description: prop.description,
            nullable: false,
        } as Schema;
    }

    return {
        name: `plugin__${def.name}`, // Namespace prefix to avoid collision with core tools
        description: `[Plugin Tool] ${def.description}`,
        parameters: {
            type: SchemaType.OBJECT,
            properties,
            required: def.parameters?.required ?? [],
        },
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface InstalledPluginSummary {
    pluginId: string;
    name: string;
    description: string | null;
    connectorType: string | null;
    toolCount: number;
}

/**
 * Returns validated Gemini FunctionDeclarations from all of the user's installed plugins.
 * Any malformed tool definitions are silently skipped (logged to console).
 */
export async function getInstalledPluginTools(userId: string): Promise<FunctionDeclaration[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('installed_plugins')
        .select('plugin:plugin_id(name, ai_tools)')
        .eq('user_id', userId);

    if (error || !data) return [];

    const declarations: FunctionDeclaration[] = [];

    for (const row of data) {
        const plugin = (row.plugin as unknown) as { name: string; ai_tools: unknown[] } | null;
        if (!plugin || !Array.isArray(plugin.ai_tools)) continue;

        for (const raw of plugin.ai_tools) {
            const validated = validateToolDef(raw);
            if (!validated) {
                console.warn(`[plugin-runtime] Skipping invalid tool def from plugin "${plugin.name}":`, raw);
                continue;
            }
            declarations.push(toFunctionDeclaration(validated));
        }
    }

    return declarations;
}

/**
 * Returns a summary of installed plugins for injecting into the AI system prompt.
 */
export async function getInstalledPluginsSummary(userId: string): Promise<InstalledPluginSummary[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('installed_plugins')
        .select('plugin:plugin_id(id, name, description, connector_type, ai_tools)')
        .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((row) => {
        const plugin = (row.plugin as unknown) as {
            id: string;
            name: string;
            description: string | null;
            connector_type: string | null;
            ai_tools: unknown[];
        } | null;
        return {
            pluginId: plugin?.id ?? '',
            name: plugin?.name ?? 'Unknown',
            description: plugin?.description ?? null,
            connectorType: plugin?.connector_type ?? null,
            toolCount: Array.isArray(plugin?.ai_tools) ? plugin!.ai_tools.length : 0,
        };
    });
}
