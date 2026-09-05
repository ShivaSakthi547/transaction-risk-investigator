import os
import json
import google.generativeai as genai

# Setup Gemini API key
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def generate_narrative(evidence_pack: dict):
    """
    Calls Gemini API to explain why signals matter and weave connections into a narrative.
    Never states or implies fraud occurred.
    """
    if not api_key:
        return {
            "investigation_narrative": "Gemini API key not found. Narrative generation skipped.",
            "check_first": "Review the flagged rules and connections."
        }

    system_prompt = """
    You are an expert fraud investigator assistant. Your job is to review a provided evidence pack containing baseline customer behavior, flagged transactions, and connection analysis.
    
    CRITICAL RULES:
    1. NEVER state or imply that fraud occurred. You only highlight unusual patterns, anomalies, and what warrants review.
    2. Ground every claim strictly in the provided evidence pack. If you cannot ground it, do not say it.
    3. Explain WHY the signals matter given the baseline comparison.
    4. Weave the connection analysis into a coherent narrative.
    5. Provide a recommendation on what a human investigator should check FIRST, with reasoning.
    
    Output your response as a valid JSON object with exactly two keys:
    - "investigation_narrative": A paragraph explaining the anomalies and their context.
    - "check_first": A short sentence or two recommending what to investigate first and why.
    """

    prompt = f"Evidence Pack:\n{json.dumps(evidence_pack, indent=2)}\n\nPlease provide your analysis in JSON format."

    try:
        model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=system_prompt)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
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
            "investigation_narrative": "Narrative generation is currently unavailable due to a service error.",
            "check_first": "Please review the raw evidence manually."
        }
