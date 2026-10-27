import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { pipeline } from 'npm:@supabase/middleware@^0.5.0';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@^1.6.0';
import { z } from 'npm:zod@^4.3.6';

import type { Database } from './database.types.ts';

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })],
    async (req, { supabase }) => {
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'flashcard', version: '1.0.0' });

        server.registerTool(
          'create_cards',
          {
            title: 'Créer des cartes',
            description:
              'Crée de 1 à 30 cartes pour le compte connecté. Un sujet doit déjà exister dans ce compte ; un sujet absent ou inconnu est ignoré.',
            inputSchema: z.object({
              cards: z
                .array(
                  z.object({
                    question: z.string().trim().min(1).max(500),
                    answer: z.string().trim().min(1).max(1000),
                    subject: z.string().trim().min(1).max(50).nullable().optional(),
                  }),
                )
                .min(1)
                .max(30),
            }),
            annotations: { destructiveHint: false, idempotentHint: false },
          },
          async ({ cards }) => {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!userData.user)
              return {
                content: [{ type: 'text', text: 'Utilisateur introuvable.' }],
                isError: true,
              };

            const { data: subjects, error: subjectsError } = await supabase
              .from('subjects')
              .select('id,name');
            if (subjectsError) throw subjectsError;
            const subjectIds = new Map(subjects.map((subject) => [subject.name, subject.id]));
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const rows = cards.map((card) => ({
              user_id: userData.user.id,
              question: card.question,
              answer: card.answer,
              subject_id: card.subject ? (subjectIds.get(card.subject) ?? null) : null,
              column: 1,
              review_interval_started_on: today,
            }));
            const { data, error } = await supabase
              .from('cards')
              .insert(rows)
              .select(
                'id,question,answer,subject_id,column,reported,review_interval_started_on,created_at',
              );
            if (error) throw error;
            const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    data.map((card) => ({
                      id: card.id,
                      question: card.question,
                      answer: card.answer,
                      subject: card.subject_id ? (subjectNames.get(card.subject_id) ?? null) : null,
                      reported: card.reported,
                      column: card.column,
                      reviewIntervalStartedOn: card.review_interval_started_on,
                      createdAt: card.created_at,
                    })),
                  ),
                },
              ],
            };
          },
        );

        server.registerTool(
          'list_cards',
          {
            title: 'Lister mes cartes',
            description:
              'Liste les cartes du compte connecté, avec leur sujet et leur progression de révision.',
            inputSchema: z.object({
              reported: z.boolean().optional(),
              limit: z.number().int().min(1).max(100).default(50),
              offset: z.number().int().min(0).default(0),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ limit, offset, reported }) => {
            let query = supabase
              .from('cards')
              .select(
                'id,question,answer,subject_id,column,reported,review_interval_started_on,created_at',
              );
            if (reported !== undefined) query = query.eq('reported', reported);
            const { data, error } = await query
              .order('created_at', { ascending: true })
              .order('id')
              .range(offset, offset + limit - 1);
            if (error) throw error;

            const subjectIds = [
              ...new Set(data.flatMap((card) => (card.subject_id ? [card.subject_id] : []))),
            ];
            const subjects = subjectIds.length
              ? await supabase.from('subjects').select('id,name').in('id', subjectIds)
              : { data: [], error: null };
            if (subjects.error) throw subjects.error;
            const names = new Map(subjects.data.map((subject) => [subject.id, subject.name]));

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    data.map((card) => ({
                      id: card.id,
                      question: card.question,
                      answer: card.answer,
                      subject: card.subject_id ? (names.get(card.subject_id) ?? null) : null,
                      reported: card.reported,
                      column: card.column,
                      reviewIntervalStartedOn: card.review_interval_started_on,
                      createdAt: card.created_at,
                    })),
                  ),
                },
              ],
            };
          },
        );

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
              .select(
                'id,question,answer,subject_id,column,reported,review_interval_started_on,created_at',
              )
              .eq('id', id)
              .maybeSingle();
            if (error) throw error;
            if (!data)
              return { content: [{ type: 'text', text: 'Carte introuvable.' }], isError: true };
            const subject = data.subject_id
              ? await supabase
                  .from('subjects')
                  .select('name')
                  .eq('id', data.subject_id)
                  .maybeSingle()
              : { data: null, error: null };
            if (subject.error) throw subject.error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    id: data.id,
                    question: data.question,
                    answer: data.answer,
                    subject: subject.data?.name ?? null,
                    reported: data.reported,
                    column: data.column,
                    reviewIntervalStartedOn: data.review_interval_started_on,
                    createdAt: data.created_at,
                  }),
                },
              ],
            };
          },
        );

        server.registerTool(
          'update_card',
          {
            title: 'Modifier une carte',
            description:
              'Modifie la question et la réponse d’une carte du compte connecté. Les deux champs sont requis.',
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
              .update({ question, answer, reported: false })
              .eq('id', id)
              .select('id,question,answer,reported')
              .maybeSingle();
            if (error) throw error;
            if (!data)
              return { content: [{ type: 'text', text: 'Carte introuvable.' }], isError: true };
            return { content: [{ type: 'text', text: JSON.stringify(data) }] };
          },
        );

        return server;
      });

      return handler.fetch(req);
    },
  ),
);
