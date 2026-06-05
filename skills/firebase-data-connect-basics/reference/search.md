# Search Solutions Reference (Vector & Full-Text Search)

Use this reference to design, configure, and implement search capabilities in SQL Connect. SQL Connect supports three types of search:
1. **Vector Similarity Search (Semantic)**: Best for finding conceptually/semantically similar rows (e.g., recommendations, "more like this"). Requires Vertex AI.
2. **Full-Text Search (Lexical)**: Best for keyword and phrase search across single or multiple columns. Supports lexical stemming.
3. **String Pattern Filters (Exact/Regex)**: Best for simple prefix, exact match, or basic wildcard queries (uses standard Postgres indexing).

---

## Search Selection Guide

Use this comparative guide to choose the optimal search strategy for the user's task:

| Feature / Capability | Vector Similarity Search | Full-Text Search | String Pattern Filters |
| :--- | :--- | :--- | :--- |
| **Use Case** | Semantic search, recommendations, RAG pipelines. | Keyword search, parsing large text fields. | Exact matches, regular expressions, simple wildcards. |
| **Engine Support** | Vertex AI Embeddings + `pgvector` extension. | Native PostgreSQL full-text engine. | Native PostgreSQL indexing (`LIKE`, `ILIKE`). |
| **Matching Style** | Semantic/concept proximity. | Lexical stemming (tenses, root words). | Exact character sequence. |
| **Column Support** | Single column per query. | Multiple columns combined. | Multiple columns via standard logical filters (`_or`). |
| **Overhead** | High (API execution costs & vector column storage). | Medium (generates indices & tsvector columns). | Low (uses standard index / minimal storage). |

---

## 1. Vector Similarity Search (Semantic)

Perform semantic matching by generating vector embeddings representing the semantic meaning of text.

### Schema Setup

* **Configure Column Dimensions**: Define the column dimension size using the `@col(size: X)` directive — SQL Connect requires an explicit size for Vector fields to allocate storage.
* **Match Model Specifications**: Ensure the column size matches the output dimension of your chosen embedding model (e.g., **768** for Google Vertex AI's `textembedding-gecko` models) to prevent runtime type mismatches.

```graphql
type Movie @table {
  id: UUID! @default(expr: "uuidV4()")
  title: String!
  description: String
  # Vector field for description embeddings (Vertex AI gecko size is 768)
  descriptionEmbedding: Vector! @col(size: 768)
}
```

### Automatic Embedding Generation (`_embed` server value)

Ensure you use the exact same embedding model across all queries and mutations on a given vector field — vector embeddings generated from different model versions are incompatible and will result in poor search relevance or errors.

#### A. Generation on Insert
Use the `${vectorFieldName}_embed` input parameter to automatically generate and store embeddings on creation.

```graphql
# connector/mutations.gql
mutation CreateMovieWithEmbedding($title: String!, $description: String!) @auth(level: USER) {
  movie_insert(data: {
    title: $title,
    description: $description,
    descriptionEmbedding_embed: {
      model: "textembedding-gecko@003",
      text: $description
    }
  })
}
```

#### B. Generation on Update
```graphql
# connector/mutations.gql
mutation UpdateMovieDescription($id: UUID!, $description: String!) @auth(level: USER) {
  movie_update(
    id: $id,
    data: {
      description: $description,
      descriptionEmbedding_embed: {
        model: "textembedding-gecko@003",
        text: $description
      }
    }
  )
}
```

### Similarity Search Queries

SQL Connect automatically generates a similarity query function for every `Vector` field in the format:
`${pluralType}_${vectorFieldName}_similarity`

#### A. Auto-Embedding Search
Use `compare_embed` to automatically convert the search query string into an embedding on the fly using Vertex AI.

```graphql
# connector/queries.gql
query SearchMoviesByDescription($query: String!) @auth(level: PUBLIC) {
  movies_descriptionEmbedding_similarity(
    compare_embed: { model: "textembedding-gecko@003", text: $query },
    limit: 5
  ) {
    id
    title
    description
  }
}
```

#### B. Custom Vector Search
Use `compare` to pass raw pre-computed float arrays (cast as a `Vector!`) directly to the search without calling Vertex AI.

```graphql
# connector/queries.gql
query SearchMoviesByCustomVector($vector: Vector!, $limit: Int!) @auth(level: PUBLIC) {
  movies_descriptionEmbedding_similarity(
    compare: $vector,
    method: L2,
    limit: $limit
  ) {
    id
    title
  }
}
```

### Tuning Vector Proximity

* **Distance Thresholding**: Select the `_metadata { distance }` field to evaluate how close the results are, then define a tight threshold using the `within` parameter.
* **Distance Metric Gotcha**: `L2` and `COSINE` return different distance scales. Re-tune your `within` threshold if you change the `method` parameter, as their distance ranges are not compatible.

```graphql
# connector/queries.gql
query SearchMoviesCosineSimilarity($query: String!) @auth(level: PUBLIC) {
  movies_descriptionEmbedding_similarity(
    compare_embed: { model: "textembedding-gecko@003", text: $query },
    method: COSINE,
    within: 0.5, # Maximum distance threshold
    limit: 5
  ) {
    id
    title
    _metadata { distance }
  }
}
```

---

## 2. Full-Text Search (Lexical)

Perform fast, stemmed keyword/phrase searches over single or multiple text columns in your table.

### Schema Setup

To index columns for full-text search, declare the `@searchable` directive on the string fields inside your table schema.

```graphql
type Movie @table {
  id: UUID! @default(expr: "uuidV4()")
  title: String! @searchable # Default language (English)
  genre: String @searchable
  description: String @searchable(language: "french") # Custom language
  rating: Float
}
```

* **Stemming Language**: By default, parsing uses English stemming. Configure custom stemming using `@searchable(language: "languagename")`.
* **Multi-Column Stemming Gotcha**: Ensure all indexed columns use the exact same language when searching over multiple columns in a single query — PostgreSQL requires matching text search configurations for multi-column queries.

---

### Full-Text Search Queries

SQL Connect automatically generates a full-text query function for each `@table` containing `@searchable` fields in the format:
`${pluralType}_search`

```graphql
# connector/queries.gql
query SearchMoviesLexical($query: String!) @auth(level: PUBLIC) {
  movies_search(query: $query, limit: 10) {
    id
    title
    genre
    description
  }
}
```

---

### Tuning Full-Text Queries

Configuring query arguments optimizes match relevance and search styles.

#### 1. Query Formats (`queryFormat` argument)
Configure the search interpretation using the `queryFormat` parameter:

* **`QUERY` (Default)**: Web-style search (e.g., `inception OR matrix`, `-"space-travel"`, quotes for exact matches).
* **`PLAIN`**: Matches all words in the query string in any lexical order (e.g., `"brown dog"` matches `"the dog was brown"`).
* **`PHRASE`**: Matches the exact, contiguous phrase sequence (e.g., `"brown dog"` matches `"the brown dog"`, but NOT `"dog is brown"`).
* **`ADVANCED`**: Allows standard, complex PostgreSQL `tsquery` operators (e.g. `inception & (matrix | sci-fi)`).

```graphql
# connector/queries.gql
query SearchMoviesExactPhrase($query: String!) @auth(level: PUBLIC) {
  movies_search(query: $query, queryFormat: PHRASE) {
    id
    title
  }
}
```

#### 2. Relevance Thresholding (`relevanceThreshold` and `_metadata.relevance`)
Results default to sorting by descending relevance rank. Select `_metadata { relevance }` to inspect match rankings, then set a minimum `relevanceThreshold` value to prune loose or irrelevant matches.

```graphql
# connector/queries.gql
query SearchMoviesHighRelevance($query: String!, $threshold: Float!) @auth(level: PUBLIC) {
  movies_search(
    query: $query,
    relevanceThreshold: $threshold, # E.g., 0.05
    limit: 5
  ) {
    id
    title
    _metadata {
      relevance
    }
  }
}
```
