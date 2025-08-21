export const DEFAULT_CODE = `# Should I buy BTC now?

## News Item

Time now: {{ system.time }}
Headline: {{ news.headline }}
Source: {{ news.source }}
Time: {{ news.published_at }}
Symbols mentioned: {% for s in news.symbols_mentioned %} {{ s.symbol }} {% endfor %}

{{ news.body }}

## Historical Context

{{ rollups["btc"].full }}

## Recent Headlines

{% for recent in recent_news["btc"] %}
- {{ recent.headline }}
{% endfor %}

## Instructions

{% include templates.instructions.4o %}`;
