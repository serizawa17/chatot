# 🤖 ENIB Assistant — RAG Document Chatbot

> Assistant conversationnel basé sur l'intelligence artificielle permettant de rechercher et d'interroger des documents administratifs de l'ENIB.

Le projet **ENIB Assistant** est un système **RAG (Retrieval-Augmented Generation)** conçu pour répondre aux questions des étudiants à partir d'un ensemble de documents PDF.

L'architecture combine :

- 🔎 recherche sémantique avec **PostgreSQL + pgvector**
- 🔤 recherche lexicale **BM25 avec OpenSearch**
- 🔀 fusion des résultats avec **Reciprocal Rank Fusion (RRF)**
- 🎯 reranking avec **BGE Reranker**
- 🧠 génération de réponse avec **Llama 3.2 via Ollama**
- ⚙️ orchestration avec **n8n**
- 🐘 PostgreSQL pour les métadonnées et embeddings
- 🌐 API/Webhooks pour communiquer avec le frontend
- 🐳 Docker pour l'ensemble de l'infrastructure

---

## 📌 Sommaire

- [Architecture](#-architecture)
- [Fonctionnement](#-fonctionnement)
- [Technologies](#-technologies)
- [Structure du projet](#-structure-du-projet)
- [Pipeline d'indexation](#-pipeline-dindexation)
- [Pipeline RAG](#-pipeline-rag)
- [Recherche hybride](#-recherche-hybride)
- [RRF](#-rrf-reciprocal-rank-fusion)
- [Reranking](#-reranking)
- [Génération de réponse](#-génération-de-réponse)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [API](#-api)
- [Services Docker](#-services-docker)
- [Base de données](#-base-de-données)
- [Sécurité](#-sécurité)
- [Améliorations futures](#-améliorations-futures)

---

# 🏗 Architecture

L'architecture générale du système est la suivante :

```text
                         ┌──────────────────────┐
                         │      Frontend        │
                         │   React / Vite       │
                         └──────────┬───────────┘
                                    │
                                    │ HTTP
                                    ▼
                         ┌──────────────────────┐
                         │        n8n           │
                         │  Workflow / RAG      │
                         └──────────┬───────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   │                                 │
                   ▼                                 ▼
          ┌─────────────────┐              ┌─────────────────┐
          │   PostgreSQL    │              │   OpenSearch    │
          │    pgvector     │              │      BM25       │
          │                 │              │                 │
          │ Vector Search   │              │ Lexical Search  │
          └────────┬────────┘              └────────┬────────┘
                   │                                 │
                   └────────────────┬────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │         RRF          │
                         │ Hybrid Fusion        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    BGE Reranker      │
                         │ bge-reranker-base   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       Ollama         │
                         │     Llama 3.2        │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Réponse + Sources  │
                         └──────────────────────┘
```

---

# ⚙️ Fonctionnement

Le système fonctionne en deux pipelines principaux.

## 1. Pipeline d'indexation

Lorsqu'un utilisateur envoie un PDF :

```text
PDF
 │
 ▼
Extraction du texte
 │
 ▼
Découpage en chunks
 │
 ▼
 ├───────────────► OpenSearch
 │                   │
 │                   └── BM25
 │
 └───────────────► Ollama
                     │
                     └── Embedding
                           │
                           ▼
                       pgvector
```

Chaque document est découpé en plusieurs morceaux appelés **chunks**.

Dans la configuration actuelle :

```text
Chunk size    : 700 caractères
Overlap       : 100 caractères
Embedding     : nomic-embed-text
Dimension     : 768
```

---

# 📚 Pipeline d'indexation

## Étape 1 — Upload du PDF

Le frontend envoie le document vers le webhook n8n :

```text
POST /webhook/upload-document
```

Le fichier est ensuite transmis au workflow d'indexation.

---

## Étape 2 — Extraction du texte

Le node :

```text
Extract PDF Text
```

extrait le texte du fichier PDF.

---

## Étape 3 — Chunking

Le node :

```text
Chunk Document
```

divise le texte en morceaux.

Exemple :

```text
Document
│
├── Chunk 0
├── Chunk 1
├── Chunk 2
├── Chunk 3
└── ...
```

Les chunks utilisent un chevauchement afin de conserver le contexte entre deux morceaux.

```text
CHUNK_SIZE = 700
CHUNK_OVERLAP = 100
```

---

# 🔎 Recherche hybride

Lorsqu'un utilisateur pose une question, deux recherches sont exécutées en parallèle.

```text
                     Question
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
        Query Embedding         BM25 Search
              │                     │
              ▼                     ▼
         pgvector              OpenSearch
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
                    RRF Fusion
```

Cette approche permet de combiner deux types de recherche.

### Recherche sémantique

PostgreSQL + pgvector recherche les chunks dont le sens est proche de la question.

Exemple :

```text
Question :
"Quels sont les horaires du RAK ?"

```

La recherche sémantique peut retrouver un document contenant :

```text
Les horaires d'ouverture du restaurant...
```

même si les mots ne sont pas exactement identiques.

### Recherche BM25

OpenSearch recherche les correspondances lexicales.

Elle est particulièrement utile pour :

- noms propres
- URLs
- noms de services
- prix
- horaires
- acronymes
- termes administratifs précis

---

# 🔀 RRF — Reciprocal Rank Fusion

Les résultats provenant de pgvector et OpenSearch sont ensuite fusionnés.

Le principe utilisé est :

```text
RRF score = Σ weight / (K + rank)
```

avec :

```text
K = 60
```

Un document présent dans les deux recherches obtient donc un score supérieur.

Exemple :

```text
Document A
Semantic rank : 2
BM25 rank     : 1

Document B
Semantic rank : 1
BM25 rank     : 20
```

La fusion permet de prendre en compte les deux systèmes de recherche plutôt que de dépendre d'un seul moteur.

Pour certaines intentions :

```text
navigation
price
schedule
rules
```

la recherche BM25 reçoit actuellement un poids supérieur.

---

# 🎯 Reranking

Après la fusion RRF, les 15 meilleurs chunks sont envoyés au :

```text
BAAI/bge-reranker-base
```

Pipeline :

```text
30 résultats semantic
        +
30 résultats BM25
        │
        ▼
      RRF
        │
        ▼
   Top 15 chunks
        │
        ▼
 BGE Reranker
        │
        ▼
 meilleurs chunks
```

Le reranker compare directement :

```text
QUESTION
+
CHUNK
```

et attribue un score de pertinence.

Cela permet de réordonner les résultats récupérés par les deux moteurs.

---

# 🧠 Génération de réponse

Les meilleurs documents sont ensuite utilisés pour construire le contexte envoyé à Llama.

Le modèle utilisé est :

```text
llama3.2:latest
```

via :

```text
Ollama
```

Le prompt impose notamment :

```text
Utiliser uniquement les informations présentes
dans le contexte.

Ne pas utiliser de connaissances externes.

Ne pas inventer d'informations.

Citer les sources avec [SOURCE X].
```

Si aucune information pertinente n'est trouvée :

```text
Je ne trouve pas cette information dans les documents fournis.
```

---

# 🔗 Gestion des sources et URLs

Le système extrait également les URLs présentes dans les chunks.

Exemple :

```text
[SOURCE 1]

Document: menu.pdf

URLS EXACTES:
https://example.com/menu

CONTENU:
...
```

Cela permet au modèle de répondre correctement aux questions telles que :

```text
Quel est le lien pour consulter le menu ?
```

sans générer ou modifier l'URL.

---

# 🐳 Technologies

| Technologie      | Utilisation             |
| ---------------- | ----------------------- |
| Docker           | Conteneurisation        |
| Docker Compose   | Orchestration locale    |
| n8n              | Workflows RAG           |
| PostgreSQL       | Base de données         |
| pgvector         | Recherche vectorielle   |
| OpenSearch       | Recherche BM25          |
| Ollama           | LLM + embeddings        |
| Llama 3.2        | Génération des réponses |
| nomic-embed-text | Embeddings              |
| BGE Reranker     | Reranking               |
| React            | Frontend                |
| Vite             | Build frontend          |
| Python           | Backend / traitements   |

---

# 📁 Structure du projet

Une organisation recommandée pour GitHub :

```text
enib-assistant/
│
├── README.md
│
├── docker-compose.yml
│
├── .env.example
├── .gitignore
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│
├── n8n/
│   ├── workflows/
│   │   └── enib-rag.json
│   └── README.md
│
├── database/
│   ├── schema.sql
│   └── queries/
│
├── opensearch/
│   └── README.md
│
├── scripts/
│   ├── setup.sh
│   └── test-rag.sh
│
├── docs/
│   ├── architecture.md
│   └── screenshots/
│
└── data/
    └── .gitkeep
```

⚠️ Les documents administratifs contenant des informations sensibles ne doivent pas être commités dans Git.

---

# 🚀 Installation

## Prérequis

Installer :

```text
Docker
Docker Compose
Git
```

Vérifier :

```bash
docker --version
docker compose version
git --version
```

---

## Cloner le projet

```bash
git clone https://github.com/<USERNAME>/enib-assistant.git

cd enib-assistant
```

---

## Configurer les variables d'environnement

Créer :

```bash
cp .env.example .env
```

Puis adapter les variables nécessaires.

⚠️ Ne jamais mettre les mots de passe réels dans Git.

---

# 🐳 Lancer l'infrastructure

Démarrer les services :

```bash
docker compose up -d
```

Vérifier :

```bash
docker compose ps
```

Voir les logs :

```bash
docker compose logs -f
```

Pour n8n :

```bash
docker compose logs -f n8n
```

Pour OpenSearch :

```bash
docker compose logs -f opensearch-node
```

---

# 🤖 Télécharger les modèles Ollama

Entrer dans le conteneur Ollama :

```bash
docker exec -it ollama bash
```

Puis :

```bash
ollama pull llama3.2:latest
```

et :

```bash
ollama pull nomic-embed-text
```

Vérifier :

```bash
ollama list
```

---

# 🔍 Vérifier OpenSearch

Tester :

```bash
curl http://localhost:9200
```

Puis :

```bash
curl http://localhost:9200/_cluster/health
```

L'index utilisé par le workflow est :

```text
rag_chunk2
```

---

# 🗄️ PostgreSQL + pgvector

La base PostgreSQL utilise l'image :

```text
pgvector/pgvector:pg16
```

Le port local est :

```text
5432
```

La base contient notamment :

```text
document_chunks
lexical_documents
```

La table `document_chunks` stocke :

```text
chunk_id
document_id
document_name
page_number
original_content
contextual_content
content
embedding
created_at
```

Les embeddings sont stockés sous forme :

```text
vector(768)
```

---

# 🌐 Services

| Service               |  Port | Fonction                  |
| --------------------- | ----: | ------------------------- |
| Backend               |  8000 | API backend               |
| PostgreSQL            |  5432 | Database + pgvector       |
| pgAdmin               |  5050 | Administration PostgreSQL |
| n8n                   |  5678 | RAG workflow              |
| Ollama                | 11434 | LLM + embeddings          |
| OpenSearch            |  9200 | BM25                      |
| OpenSearch Dashboards |  5601 | Interface OpenSearch      |
| BGE Reranker          |  8080 | Reranking                 |

---

# 📡 API

## Upload d'un document

```http
POST /webhook/upload-document
```

Le frontend envoie un fichier PDF en :

```text
multipart/form-data
```

avec le champ :

```text
data
```

Réponse :

```json
{
  "status": "processing",
  "message": "Document received, indexing in the background.",
  "document_id": "..."
}
```

---

## Poser une question

```http
POST /webhook/chat
```

Body :

```json
{
  "chatInput": "Quels sont les horaires du RAK ?",
  "sessionId": "session-001"
}
```

Réponse :

```json
{
  "output": "Les horaires sont ...",
  "answer": "Les horaires sont ...",
  "sources": [
    {
      "source": 1,
      "document_name": "rak.pdf",
      "page_number": 2,
      "chunk_id": "doc-001-3"
    }
  ]
}
```

---

# 🔄 Pipeline complet

```text
                    ┌──────────────┐
                    │   PDF Upload │
                    └──────┬───────┘
                           │
                           ▼
                   Extract PDF Text
                           │
                           ▼
                    Chunk Document
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        OpenSearch                 Ollama
           BM25                  Embedding
              │                         │
              │                         ▼
              │                    PostgreSQL
              │                     pgvector
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                      User Query
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
         Vector Search              BM25 Search
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                       RRF Fusion
                           │
                           ▼
                       Top 15
                           │
                           ▼
                    BGE Reranker
                           │
                           ▼
                     Top Documents
                           │
                           ▼
                     Final Context
                           │
                           ▼
                      Llama 3.2
                           │
                           ▼
                   Answer + Sources
```

---

# 🧪 Exemple

Question :

```text
Quels sont les horaires d'ouverture du RAK ?
```

Le système effectue :

```text
1. Normalisation de la question
2. Détection de l'intention
3. Génération de l'embedding
4. Recherche pgvector
5. Recherche BM25
6. Fusion RRF
7. Reranking BGE
8. Sélection des documents pertinents
9. Construction du contexte
10. Génération avec Llama
11. Retour de la réponse et des sources
```

---

# 🔐 Sécurité

Avant de publier le projet sur GitHub :

### Ne jamais commit

```text
.env
credentials
passwords
API keys
tokens
documents administratifs privés
base de données
volumes Docker
```

Ajouter au `.gitignore` :

```gitignore
.env
.env.*
!.env.example

node_modules/
__pycache__/
*.pyc

data/*
!data/.gitkeep

*.pdf
*.docx

.n8n/
postgres_data/
opensearch_data/
ollama_data/

credentials.json
```

---

# ⚠️ Configuration de développement

La configuration actuelle utilise notamment :

```text
DISABLE_SECURITY_PLUGIN=true
```

pour OpenSearch.

Cette configuration est adaptée au développement local mais doit être revue avant une mise en production.

De même, les webhooks utilisent actuellement :

```text
Access-Control-Allow-Origin: *
```

Pour une application déployée, il est préférable de limiter les origines autorisées au domaine du frontend.

---

# 📊 Monitoring et administration

## pgAdmin

```text
http://localhost:5050
```

## n8n

```text
http://localhost:5678
```

## OpenSearch

```text
http://localhost:9200
```

## OpenSearch Dashboards

```text
http://localhost:5601
```

## Ollama

```text
http://localhost:11434
```

## Reranker

```text
http://localhost:8080
```

---

# 🛠️ Commandes utiles

### Démarrer

```bash
docker compose up -d
```

### Arrêter

```bash
docker compose down
```

### Voir les conteneurs

```bash
docker compose ps
```

### Logs

```bash
docker compose logs -f
```

### Reconstruire

```bash
docker compose build --no-cache
docker compose up -d
```

### Redémarrer n8n

```bash
docker compose restart n8n
```

### Vérifier Ollama

```bash
docker exec -it ollama ollama list
```

---

# 🚧 Améliorations futures

Plusieurs évolutions sont prévues :

- [ ] Chunking basé sur les pages PDF
- [ ] Extraction des métadonnées PDF
- [ ] Support OCR pour les documents scannés
- [ ] Amélioration de la détection d'intention
- [ ] Recherche hybride avec pondération dynamique
- [ ] Évaluation automatique du RAG
- [ ] Dataset de questions/réponses de test
- [ ] Métriques Recall\@K et MRR
- [ ] Monitoring Grafana
- [ ] Authentification utilisateur
- [ ] Gestion des sessions
- [ ] Streaming des réponses LLM
- [ ] Support de plusieurs modèles LLM
- [ ] Déploiement cloud
- [ ] HTTPS
- [ ] Gestion des permissions par document

---

# 📈 Évaluation du RAG

Pour mesurer la qualité du système, un dataset de test peut être créé :

```text
question
expected_document
expected_answer
```

Exemple :

```json
{
  "question": "Quels sont les horaires du RAK ?",
  "expected_document": "rak.pdf",
  "expected_answer": "..."
}
```

Les métriques envisagées :

```text
Recall@5
Recall@10
MRR
Precision@K
Answer relevancy
Faithfulness
```

---

# 👨‍💻 Auteur

**Ismail El Mekkaoui**

Étudiant ingénieur en informatique / mécatronique, électronique et informatique à l'ENIB.

Projet réalisé dans le cadre d'un projet de développement d'un assistant documentaire basé sur les techniques de :

```text
RAG
Vector Search
BM25
RRF
Reranking
LLM
```

---

# 📄 Licence

Projet académique.

La réutilisation et la distribution des documents administratifs utilisés pour l'indexation doivent respecter les droits et conditions applicables aux documents concernés.
