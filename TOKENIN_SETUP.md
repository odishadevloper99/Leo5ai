# Tokenin model setup

The app now routes these model IDs directly to the Tokenin provider:

- myt/grok-4.6-free
- myt/kimi-k3-free
- myt/glm-5.3-free
- myt/qwen3.8-max-free
- myt/deepseek-v4-pro-free

Set these backend environment variables:

TOKENIN_API_KEY=your_tokenin_api_key
TOKENIN_BASE_URL=https://tokenin.my.id/api/v1

The selected Tokenin models do not use the AICredits provider. Other existing models keep the existing provider path.

Premium access is controlled server-side. Admins can assign Premium/Pro/Ultra and set an individual daily message limit from the Admin Panel.
