from google.adk.agents.llm_agent import Agent
from . import tools

import os

script_dir = os.path.dirname(os.path.abspath(__file__))
prompt_path = os.path.join(script_dir, 'task_prompt.md')

with open(prompt_path, 'r') as f:
    instruction = f.read()

root_agent = Agent(
    model='gemini-2.5-flash',
    name='tax_specialist',
    description='A Tax Specialist agent that processes receipts and categorizes expenses.',
    instruction=instruction,
    tools=[tools.store_receipt_to_firestore, tools.tax_categorizer],
)
