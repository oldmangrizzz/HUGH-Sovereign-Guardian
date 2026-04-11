import asyncio
import os
import cognee
from cognee.api.v1.search import SearchType

async def query_memory():
    print("--- QUERYING JASON BLUEPRINT ---")
    try:
        jason_result = await cognee.search(
            query_type=SearchType.GRAPH_COMPLETION, 
            query_text='Jason blueprint tactical node GPU'
        )
        print(jason_result)
    except Exception as e:
        print(f"Jason Query Error: {e}")
    
    print("\n--- QUERYING NATASHA PROTOCOLS ---")
    try:
        natasha_result = await cognee.search(
            query_type=SearchType.GRAPH_COMPLETION, 
            query_text='Natasha Romanova intelligence sweep protocols'
        )
        print(natasha_result)
    except Exception as e:
        print(f"Natasha Query Error: {e}")

if __name__ == "__main__":
    # Ensure Cognee uses the correct .env
    os.chdir(os.path.expanduser("~/cognee"))
    asyncio.run(query_memory())
