// src/caption/generate.ts — AI caption generation via DeepSeek API

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * Generate a poetic Chinese caption for a set of dominant colors.
 *
 * Calls the DeepSeek API with a system prompt that asks for
 * a short (≤20 char), warm, visually evocative one-liner.
 * Optionally incorporates the user's personal feeling/memory
 * for richer, more personalized output.
 *
 * @param colorDescriptors  Array of color names/hex codes.
 * @param timeLabel         Human-readable time period, e.g. "2026年3月".
 * @param userFeeling       Optional: user's impression / feeling about this period.
 * @returns                 The generated caption, or an empty string on failure.
 */
export async function generateCaption(
  colorDescriptors: string[],
  timeLabel: string,
  userFeeling?: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.warn('[generateCaption] DEEPSEEK_API_KEY is not set');
    return '';
  }

  const colorList = colorDescriptors.join('、');

  let prompt: string;
  if (userFeeling && userFeeling.trim().length > 0) {
    prompt = `你是一位诗意文案写手。用户的${timeLabel}生活照片主色调是：${colorList}。用户对这个时段的感受是："${userFeeling.trim()}"。请结合这份感受，写一句话（20字以内），文艺、温暖、有画面感。不要加引号，只返回句子。`;
  } else {
    prompt = `你是一位诗意文案写手。用户的${timeLabel}生活照片主色调是：${colorList}。请写一句话（20字以内），文艺、温暖、有画面感。不要加引号，只返回句子。`;
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[generateCaption] DeepSeek API error ${response.status}: ${errorText}`,
      );
      return '';
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Strip surrounding quotes if the model wraps the output
    const caption = raw.replace(/^["'「『“]|["'」』”]$/g, '');

    return caption;
  } catch (error) {
    console.error('[generateCaption] Network or parsing error:', error);
    return '';
  }
}
