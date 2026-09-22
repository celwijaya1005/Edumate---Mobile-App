// Supabase Edge Function: analyze-quiz
// Menerima attemptId, ambil detail kuis + jawaban murid dari DB,
// minta Gemini bikin analisis & saran personal, lalu simpan hasilnya.
//
// Deploy: supabase functions deploy analyze-quiz
// Set secret dulu: supabase secrets set GEMINI_API_KEY=xxxxx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const { attemptId, language } = await req.json();
    if (!attemptId) return json({ error: 'attemptId is required' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Validasi: pastikan yang manggil ini beneran user yang login
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    // Ambil attempt yang mau dianalisis
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('id_attempt, id_user, id_quiz, score, answers')
      .eq('id_attempt', attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error('Attempt lookup failed. attemptId:', attemptId, 'error:', attemptError);
      return json({ error: 'Attempt not found', detail: attemptError?.message || null, attemptId }, 404);
    }
    // Pastikan murid cuma bisa minta analisis buat attempt miliknya sendiri
    if (attempt.id_user !== userData.user.id) return json({ error: 'Forbidden' }, 403);

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('title')
      .eq('id_quiz', attempt.id_quiz)
      .single();

    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('id_question, question_text, option_a, option_b, option_c, option_d, correct_option, order_index')
      .eq('quiz_id', attempt.id_quiz)
      .order('order_index', { ascending: true });

    const answerMap = new Map(
      (attempt.answers || []).map((a: any) => [a.question_id, a.selected_option])
    );

    const qaList = (questions || []).map((q: any, i: number) => {
      const selected = answerMap.get(q.id_question);
      return {
        no: i + 1,
        pertanyaan: q.question_text,
        pilihan: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
        jawaban_benar: q.correct_option,
        jawaban_murid: selected || '(tidak dijawab)',
        benar: selected === q.correct_option,
      };
    });

    const lang = language === 'en' ? 'English' : 'Bahasa Indonesia';

    const prompt = `Kamu adalah asisten belajar yang menganalisis hasil kuis seorang murid di aplikasi belajar online bernama Edumate.

Judul kuis: ${quiz?.title || '-'}
Skor murid: ${attempt.score}/100

Rincian tiap soal (benar/salah beserta pilihan yang dipilih murid):
${JSON.stringify(qaList, null, 2)}

Tugasmu:
1. Tulis analisis singkat (2-4 kalimat) dalam ${lang} tentang pemahaman murid terhadap materi ini. Kalau ada soal yang salah, sebutkan secara spesifik topik/konsepnya (jangan cuma bilang "ada beberapa soal salah").
2. Tulis satu saran konkret (1-2 kalimat) tentang langkah belajar selanjutnya yang paling relevan.

Balas HANYA dalam format JSON persis seperti ini, tanpa markdown code fence, tanpa teks lain di luar JSON:
{"analysis": "...", "suggestion": "..."}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return json({ error: 'AI request failed', status: geminiRes.status, detail: errText }, 502);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsed: { analysis?: string; suggestion?: string } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('Failed to parse Gemini JSON:', rawText);
      return json({ error: 'Invalid AI response' }, 502);
    }

    const analysis = parsed.analysis || null;
    const suggestion = parsed.suggestion || null;

    await supabase
      .from('quiz_attempts')
      .update({ ai_feedback: analysis, ai_suggestion: suggestion })
      .eq('id_attempt', attemptId);

    return json({ analysis, suggestion });
  } catch (e) {
    console.error('Unexpected error in analyze-quiz:', e);
    return json({ error: 'Internal error' }, 500);
  }
});