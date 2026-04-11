#!/bin/bash
exec ssh -i ~/.ssh/hugh_vps \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  root@76.13.146.61 \
  "HERMES_HOME=/opt/hermes-natasha/home \
   OPENAI_API_KEY=0ca9b079f0be4b78af10820414ffca2a._nnUXVJrSsgqtZHIlqzwUFvJ \
   /opt/hermes-natasha/venv/bin/hermes mcp serve"
