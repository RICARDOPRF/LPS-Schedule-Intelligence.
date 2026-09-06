# LPS Schedule Intelligence

Inteligência aplicada à avaliação de cronogramas de projetos industriais.

## V1 — módulos implementados

- Importação de **Microsoft Project XML**
- Importação de **Primavera P6 XER/XML**
- Conector para `.MPP` nativo via API segura
- Mapeamento **Projeto → Setor → Área → Disciplina → Atividade**
- Detecção de linhas de base com dados válidos
- Filtro por setor, área e disciplina
- Auditoria de rede lógica
- Atividades órfãs / sem predecessora / sem sucessora
- Restrições, lags, relações não FS, durações extensas
- Folga negativa e folga excessiva
- Atividades vencidas e incompletas
- Marcos com lógica fraca
- Schedule Health Score
- Próximo ponto crítico provável
- Curva S semanal
- Uso de timephased data quando disponível
- Fallback identificado quando a distribuição temporal não existir
- Histograma de HH
- Exportação XLSX
- Contract Compliance
- Comparação de revisões
- Relatório técnico / PDF
- Modo Contratada e modo Cliente/Fiscalização
- Aprendizado opcional de regras anonimizadas

## Arquitetura

```text
Navegador / GitHub Pages
        │
        ├── XML / XER → processamento local
        │
        └── MPP / IA / aprendizado → API LPS protegida
                                      │
                                      ├── parser MPP
                                      ├── regras / modelo canônico
                                      ├── parecer de IA
                                      └── base de aprendizado anonimizada
```

### Por que `.MPP` usa backend?
O formato nativo do Microsoft Project é binário. O backend usa um conversor baseado em MPXJ para extrair o conteúdo e devolver um modelo normalizado ao frontend.

## Modelo canônico
Cada parser converte o cronograma para uma estrutura comum:

- Project
- WBS / hierarchy
- Task
- Relation
- Baseline[]
- Resource
- Assignment
- Timephased data
- Custom fields

Isso evita escrever uma lógica diferente de auditoria para cada software.

## Regra da Curva S

1. identifica o peso da atividade por campo de peso/pontos quando existir;
2. se não houver peso explícito, usa HH planejado quando disponível;
3. se não houver nenhum dos dois, usa peso unitário e informa o fallback;
4. prioriza valores distribuídos no tempo (timephased / Uso da Tarefa);
5. quando não houver timephased, distribui entre início e término e marca a curva como fallback;
6. agrega por semana e normaliza para o escopo selecionado.

## Baselines

- nenhuma baseline válida → cronograma atual é oferecido como referência;
- uma ou mais baselines válidas → o usuário escolhe qual usar;
- a cobertura da baseline é auditada antes de sua utilização.

## API segura
Código em `api-server/`.

Rotas:

- `GET /health`
- `POST /v1/parse/mpp`
- `POST /v1/ai/report`
- `POST /v1/learning/observe`
- `POST /v1/learning/correction`

A API é **fail closed**: se autenticação não estiver configurada, as rotas protegidas não ficam abertas.

## Aprendizado
O Schedule Intelligence não precisa guardar cronogramas brutos para evoluir. O mecanismo foi desenhado para aprender principalmente:

- nomes alternativos de campos;
- padrões de WBS;
- regras de classificação de disciplina;
- correções feitas pelo usuário;
- qualidade de detecção por tipo de arquivo;
- presença/ausência de timephased data e baselines.

Os eventos são anonimizados e criptografados quando enviados ao backend. Retenção de arquivo bruto é uma opção separada e desabilitada por padrão.

## Próximas evoluções do motor

- interface para corrigir manualmente Setor / Área / Disciplina e ensinar a regra;
- exportação diretamente no template oficial do Painel de Bordo;
- curvas individuais por disciplina + consolidada em um único clique;
- análise de calendários e resource leveling;
- DCMA-style checks configuráveis;
- grafo visual do caminho crítico;
- comparação profunda de baselines;
- forecast probabilístico e cadeia de causa do atraso;
- integração direta com o Painel de Bordo LPS.

## Privacidade
Leia `SECURITY.md` antes de publicar o backend em produção.
