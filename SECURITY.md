# LPS Schedule Intelligence — Segurança e Privacidade

## Princípio
Cronogramas de clientes podem conter dados contratuais, comerciais e operacionais sensíveis. Por isso, o aplicativo adota **privacy by default**.

## Regras obrigatórias

1. **Nenhuma chave secreta no frontend.** Chaves de IA, criptografia e autenticação ficam somente em variáveis de ambiente do backend.
2. **HTTPS em produção.** Todo tráfego entre navegador e API deve usar TLS.
3. **Autenticação obrigatória.** As rotas `/v1/parse/*`, `/v1/ai/*` e `/v1/learning/*` rejeitam requisições quando a autenticação não está configurada.
4. **CORS restrito.** Somente origens explicitamente configuradas em `LPS_ALLOWED_ORIGINS` podem usar a API pelo navegador.
5. **Descarte por padrão.** `.MPP` enviado para análise é salvo apenas em diretório temporário, processado e removido no `finally`.
6. **Retenção somente com consentimento.** `ALLOW_RAW_RETENTION=false` é o padrão. Quando habilitada e solicitada, o arquivo é criptografado com AES-256-GCM usando chave que nunca entra no repositório.
7. **Aprendizado sem arquivo bruto.** O endpoint de aprendizado recebe somente métricas agregadas e hashes de nomes de campos. Correções podem ser armazenadas como padrões anonimizados.
8. **IA recebe resumo sanitizado.** O endpoint de parecer envia métricas e achados técnicos, não o `.MPP` bruto.
9. **Sem treinamento oculto.** O aprendizado do produto significa aperfeiçoar regras/mapeamentos da LPS. Uso de dados para treinamento de qualquer provedor externo deve depender de consentimento e configuração específica.

## Segredos
Use `.env` no servidor ou o gerenciador de segredos da plataforma. Nunca faça commit de:

- `OPENAI_API_KEY`
- `LPS_DATA_KEY`
- `LPS_LEARNING_KEY`
- tokens internos
- credenciais de banco

## Criptografia em repouso
`LPS_DATA_KEY` e `LPS_LEARNING_KEY` devem ser chaves aleatórias independentes de 32 bytes codificadas em Base64. O backend usa AES-256-GCM com IV aleatório por registro/arquivo.

## Observação importante
O repositório do frontend pode ser público. Código de segurança pode ser público; **segredos não podem**. Segurança correta depende de autenticação, autorização, chaves server-side e configuração do ambiente, não de esconder JavaScript.
