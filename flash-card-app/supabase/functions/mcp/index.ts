import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { pipeline } from 'npm:@supabase/middleware@^0.5.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@^1.6.0'
import { z } from 'npm:zod@^4.3.6'

import type { Database } from './database.types.ts'

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })],
    async (req, { supabase }) => {
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'flashcard', version: '1.0.0' })

        server.registerTool(
          'list_cards',
          {
            title: 'Lister mes cartes',
            description: 'Liste les cartes du compte connecté, avec leur sujet et leur progression de révision.',
            inputSchema: z.object({
              limit: z.number().int().min(1).max(100).default(50),
              offset: z.number().int().min(0).default(0),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ limit, offset }) => {
            const { data, error } = await supabase
              .from('cards')
              .select('id,question,answer,subject_id,column,review_interval_started_on,created_at')
              .order('created_at', { ascending: true })
              .range(offset, offset + limit - 1)
            if (error) throw error

            const subjectIds = [...new Set(data.flatMap((card) => card.subject_id ? [card.subject_id] : []))]
            const subjects = subjectIds.length
              ? await supabase.from('subjects').select('id,name').in('id', subjectIds)
              : { data: [], error: null }
            if (subjects.error) throw subjects.error
            const names = new Map(subjects.data.map((subject) => [subject.id, subject.name]))

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(data.map((card) => ({
                  id: card.id,
                  question: card.question,
                  answer: card.answer,
                  subject: card.subject_id ? names.get(card.subject_id) ?? null : null,
                  column: card.column,
                  reviewIntervalStartedOn: card.review_interval_started_on,
                  createdAt: card.created_at,
                }))),
              }],
            }
          },
        )

        server.registerTool(
          'get_card',
          {
            title: 'Consulter une carte',
            description: 'Consulte une carte appartenant au compte connecté.',
            inputSchema: z.object({ id: z.string().uuid() }),
            annotations: { readOnlyHint: true },
          },
          async ({ id }) => {
            const { data, error } = await supabase
              .from('cards')
              .select('id,question,answer,subject_id,column,review_interval_started_on,created_at')
              .eq('id', id)
              .maybeSingle()
            if (error) throw error
            if (!data) return { content: [{ type: 'text', text: 'Carte introuvable.' }], isError: true }
            const subject = data.subject_id
              ? await supabase.from('subjects').select('name').eq('id', data.subject_id).maybeSingle()
              : { data: null, error: null }
            if (subject.error) throw subject.error
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  id: data.id,
                  question: data.question,
                  answer: data.answer,
                  subject: subject.data?.name ?? null,
                  column: data.column,
                  reviewIntervalStartedOn: data.review_interval_started_on,
                  createdAt: data.created_at,
                }),
              }],
            }
          },
        )

        server.registerTool(
          'update_card',
          {
            title: 'Modifier une carte',
            description: 'Modifie la question et la réponse d’une carte du compte connecté. Les deux champs sont requis.',
            inputSchema: z.object({
              id: z.string().uuid(),
              question: z.string().trim().min(1).max(500),
              answer: z.string().trim().min(1).max(1000),
            }),
            annotations: { destructiveHint: false, idempotentHint: true },
          },
          async ({ id, question, answer }) => {
            const { data, error } = await supabase
              .from('cards')
              .update({ question, answer })
              .eq('id', id)
              .select('id,question,answer')
              .maybeSingle()
            if (error) throw error
            if (!data) return { content: [{ type: 'text', text: 'Carte introuvable.' }], isError: true }
            return { content: [{ type: 'text', text: JSON.stringify(data) }] }
          },
        )

        return server
      })

      return handler.fetch(req)
    },
  ),
)
