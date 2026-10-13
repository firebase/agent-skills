# Multimodal Input

Multimodal input lets you send images, audio, video, and documents (PDF or plain
text) together with a text prompt in a single `generateContent` call, so the
model can caption, classify, answer questions about, transcribe, or summarize
them. Reach for it whenever the user's request involves *understanding* a file
rather than producing one (generating images is a separate capability). It works
with the general-purpose Gemini models listed in the
[models documentation](https://firebase.google.com/docs/ai-logic/models.md.txt)
and has no billing requirement beyond your API provider's.

## Configuration

Every non-text part of a request is passed as **inline data** (the raw file
bytes, which the SDK base64-encodes in transit) **together with its MIME type**.
The Android and Apple SDKs additionally accept platform-native image types
(`Bitmap`; `UIImage`, `NSImage`, `CIImage`, `CGImage`) without a MIME type;
those are converted client-side to JPEG at 80% quality. Pass an explicit
inline-data part with a MIME type instead when you need PNG transparency or
exact control over the encoding.

> [!WARNING] **The total request size limit is 20 MB.** Inline data is
> base64-encoded in transit (which grows it by about a third), and an oversized
> request fails with **HTTP 413**. For files larger than that, store them in
> Cloud Storage for Firebase and pass their `gs://` URLs instead. Note that
> Cloud Storage URLs (`fileData` / file parts) are **only accepted when the app
> uses the Agent Platform Gemini API (formerly branded Vertex AI) as its
> provider**, which requires the Blaze plan. With the Gemini Developer API (this
> skill's default) the only URL input is a public or unlisted YouTube video URL
> (one per request). See
> [Cloud Storage for Firebase with AI Logic](https://firebase.google.com/docs/ai-logic/solutions/cloud-storage.md.txt)
> and
> [options for providing files](https://firebase.google.com/docs/ai-logic/input-file-requirements.md.txt).

Supported input types (each page lists the full MIME types, per-request limits,
tokenization, and best practices):

| Input    | Common MIME types                                             | Limits per request                                  | Official page                                                                           |
| :------- | :------------------------------------------------------------ | :-------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| Image    | `image/png`, `image/jpeg`, `image/webp`                       | 3,000 images; scaled down to fit 3072 x 3072        | [Analyze images](https://firebase.google.com/docs/ai-logic/analyze-images.md.txt)       |
| Audio    | `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/aac`, and more | 1 audio file                                        | [Analyze audio](https://firebase.google.com/docs/ai-logic/analyze-audio.md.txt)         |
| Video    | `video/mp4`, `video/quicktime`, `video/webm`, and more        | 10 video files                                      | [Analyze video](https://firebase.google.com/docs/ai-logic/analyze-video.md.txt)         |
| Document | `application/pdf`, `text/plain`                               | 1,000 pages and 50 MB per file; each page = 1 image | [Analyze documents](https://firebase.google.com/docs/ai-logic/analyze-documents.md.txt) |

Prompting tips from the official guides: place the file(s) *before* the text
prompt, and when sending several images give each an index in the prompt
(`image 1`, `image 2`, ...) so you and the model can refer to them.

## Troubleshooting

- **HTTP 413 (request too large)**: the total request exceeded 20 MB after
  base64 encoding. Compress or downscale images (anything above 3072 x 3072 is
  scaled down server-side anyway), trim audio/video, split long PDFs, or upload
  the file to Cloud Storage for Firebase and pass its `gs://` URL. The URL route
  requires the Agent Platform Gemini API provider; see
  [Cloud Storage for Firebase with AI Logic](https://firebase.google.com/docs/ai-logic/solutions/cloud-storage.md.txt).
- **Unsupported MIME type / file format errors**: only the MIME types listed on
  the per-media page are accepted (for example images must be PNG, JPEG, or
  WebP, so convert HEIC or GIF before sending), and audio is limited to one file
  per request. Check the matching page in the table above, or the full
  [supported input files and requirements](https://firebase.google.com/docs/ai-logic/input-file-requirements.md.txt).
  On Web, `file.type` can be an empty string for files the browser does not
  recognize; set `mimeType` explicitly in that case.

See the official guides:
[Analyze images](https://firebase.google.com/docs/ai-logic/analyze-images),
[Analyze audio](https://firebase.google.com/docs/ai-logic/analyze-audio),
[Analyze video](https://firebase.google.com/docs/ai-logic/analyze-video),
[Analyze documents](https://firebase.google.com/docs/ai-logic/analyze-documents).

Last verified against
https://firebase.google.com/docs/ai-logic/generate-text.md.txt (multimodal
section), the analyze-images, analyze-audio, analyze-video, and
analyze-documents pages under https://firebase.google.com/docs/ai-logic/, and
the Firebase SDK sources (firebase-android-sdk, firebase-ios-sdk,
firebase-js-sdk, flutterfire; `main` branches) on 2026-10-08.
