import os
import json
import warnings

# Suppress the FutureWarning from the legacy google-generativeai package
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

# Try the new SDK first, fall back to legacy if not installed
try:
    from google import genai as new_genai
    from google.genai import types as genai_types
    _USE_NEW_SDK = True
except ImportError:
    import google.generativeai as genai_legacy
    _USE_NEW_SDK = False

# Setup Gemini API key
api_key = os.environ.get("GEMINI_API_KEY")

def generate_narrative(evidence_pack: dict):
    """
    Calls Gemini API to explain why signals matter and weave connections into a narrative.
    Never states or implies fraud occurred.
    """
    if not api_key:
        return {
            "investigation_narrative": "Gemini API key not found. Narrative generation skipped — all deterministic findings above are still fully accurate.",
            "check_first": "Review the flagged rules and connections in the sections above."
        }

    system_prompt = (
        "You are an expert fraud investigator assistant. Your job is to review a provided evidence pack "
        "containing baseline customer behavior, flagged transactions, and connection analysis.\n\n"
        "CRITICAL RULES:\n"
        "1. NEVER state or imply that fraud occurred. You only highlight unusual patterns, anomalies, and what warrants review.\n"
        "2. Ground every claim strictly in the provided evidence pack. If you cannot ground it, do not say it.\n"
        "3. Explain WHY the signals matter given the baseline comparison.\n"
        "4. Weave the connection analysis into a coherent narrative.\n"
        "5. Provide a recommendation on what a human investigator should check FIRST, with reasoning.\n\n"
        "Output your response as a valid JSON object with exactly two keys:\n"
        '- "investigation_narrative": A paragraph explaining the anomalies and their context.\n'
        '- "check_first": A short sentence or two recommending what to investigate first and why.'
    )

    prompt = f"Evidence Pack:\n{json.dumps(evidence_pack, indent=2)}\n\nPlease provide your analysis in JSON format."

    try:
        if _USE_NEW_SDK:
            # google-genai >= 1.0.0
            client = new_genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                )
            )
            result = json.loads(response.text)
        else:
            # Legacy google-generativeai
            genai_legacy.configure(api_key=api_key)
            model = genai_legacy.GenerativeModel(
                "gemini-1.5-flash",
                system_instruction=system_prompt
            )
            response = model.generate_content(
                prompt,
                generation_config=genai_legacy.GenerationConfig(
                    response_mime_type="application/json",
                )
            )
            result = json.loads(response.text)

        return {
            "investigation_narrative": result.get("investigation_narrative", "Analysis could not be generated."),
            "check_first": result.get("check_first", "Please review the raw evidence manually.")
        }

    except Exception as e:
        print(f"LLM generation failed: {e}")
        return {
            "investigation_narrative": "Narrative generation is currently unavailable. All deterministic findings above remain fully accurate.",
            "check_first": "Please review the raw flagged transactions and rule findings manually."
        }
