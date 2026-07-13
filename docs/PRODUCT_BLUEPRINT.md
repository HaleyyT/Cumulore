# **Cumulore** 

## (Automatic Library \- knowledge that grows together with progress)

## **End-to-End Product, Engineering and Commercial Development Blueprint**

**Document status:** Product and engineering master specification  
**Working product name:** Automatic Library  
**Initial market:** University students managing semester-long courses  
**Long-term market:** Students, researchers, educators, professionals and lifelong learners  
**Primary platform:** Responsive web application  
**Product category:** AI-powered self-maintaining learning and knowledge workspace

---

# **1\. Executive Summary**

Automatic Library is an intelligent learning workspace that converts collections of files, text, links and media into personalised, organised and continuously updated learning resources.

A user creates a folder, chooses how they want to learn, and adds materials over time. The system automatically:

* processes the new material;  
* generates source-specific notes;  
* updates cumulative living notes;  
* extracts concepts, definitions and relationships;  
* generates practice resources;  
* identifies contradictions and knowledge gaps;  
* preserves user edits;  
* records what changed;  
* maintains links back to the original evidence.

The primary product promise is:

Add each week’s course material and receive trustworthy, personalised notes and practice resources that remain organised and current throughout the semester.

Automatic Library should not be positioned merely as an AI summariser. Its core category is:

**Automated knowledge maintenance for learning.**

---

# **2\. Strategic Product Thesis**

## **2.1 The recurrent problem**

Learners repeatedly perform the same preparation work:

1. Collect documents from multiple sources.  
2. Determine how the documents relate.  
3. Extract important information.  
4. Create notes.  
5. Update earlier notes when later material adds context.  
6. Create practice resources.  
7. Search through old material.  
8. Decide what to review.  
9. Reorganise everything as the subject becomes more complex.

Existing AI tools can generate useful outputs, but many workflows remain dependent on individual prompts and isolated source collections.

The unmet need is not simply:

“Summarise this document.”

It is:

“Continuously maintain my learning system as my information changes.”

## **2.2 Product hypothesis**

Users will repeatedly use and pay for a product that:

* saves substantial preparation time;  
* produces resources in their preferred style;  
* stays current without repeated setup;  
* retains reliable links to source evidence;  
* makes large subjects easier to navigate;  
* protects their manual improvements;  
* helps them move from understanding to practice.

## **2.3 Initial wedge**

The first version should solve one specific workflow exceptionally well:

A university student uploads weekly course materials into one course folder, and the product automatically maintains weekly notes, master notes, a glossary and practice questions.

This wedge is narrow enough to build and validate, while supporting expansion into research and professional knowledge management later.

---

# **3\. Competitive Positioning**

## **3.1 Existing competitor capabilities**

NotebookLM already supports source-grounded questions, citations and generated study resources such as flashcards, quizzes, reports, mind maps and audio-based outputs.

StudyFetch converts lectures, slides, notes and recordings into structured notes, flashcards, quizzes and personalised tutoring experiences.

RemNote supports source-linked PDF learning, AI-generated flashcards and spaced-repetition review.

Notion offers workspace-wide search and automated agents whose runs can be logged and changes reversed.

Therefore, the following features alone are not sufficient differentiation:

* AI summaries;  
* upload-and-chat;  
* flashcard generation;  
* quizzes;  
* source citations;  
* PDF annotation;  
* AI tutors;  
* semantic search;  
* generic agents.

## **3.2 Primary differentiation**

Automatic Library should differentiate through the combination of:

### **Persistent Folder Automation**

Users define an enduring learning policy once. The policy automatically applies whenever relevant content is added.

### **Living Knowledge Documents**

Generated documents evolve incrementally rather than being recreated as disposable outputs.

### **Protected Human Editing**

The system distinguishes AI-owned, user-owned and shared sections. User changes are not silently overwritten.

### **Hierarchical Knowledge Scope**

Folders and subfolders determine which sources may contribute to each generated output.

### **Reviewable Change Management**

Every update shows what was added, removed, expanded or contradicted.

### **Personal Learning Style**

The system learns structural preferences from example notes and explicit settings.

### **Continuous Learning Progression**

The system connects overview, detailed explanation, examples, practice, review and progress rather than producing isolated artefacts.

### **Evidence and Trust**

Generated claims retain provenance at page, slide, section or timestamp level.

## **3.3 Product positioning statement**

For students overwhelmed by continuously growing course material, Automatic Library is a self-maintaining learning workspace that automatically keeps notes, explanations and practice resources organised and current.

Unlike one-off document chat or study-generation tools, Automatic Library preserves personal edits, understands folder scope and shows exactly how every new source changes the learner’s knowledge system.

---

# **4\. Defensible Advantage**

No individual feature creates a lasting moat. The defensible system should be built from several reinforcing advantages.

## **4.1 Workflow advantage**

The product should require less repeated prompting than competitors.

A user should be able to create a course recipe once and use it for an entire semester.

## **4.2 Personalisation advantage**

The system should accumulate:

* preferred note structures;  
* explanation depth;  
* terminology preferences;  
* learning weaknesses;  
* question difficulty preferences;  
* accepted and rejected generations;  
* editing patterns.

This improves the product with continued use.

## **4.3 Trust advantage**

Every claim, note update and generated answer should be inspectable.

Users should be able to understand:

* where the information came from;  
* which sources contributed;  
* what was inferred;  
* what changed;  
* how confident the system is;  
* whether conflicting material exists.

## **4.4 Data-structure advantage**

The product should retain structured relationships between:

* source files;  
* extracted sections;  
* concepts;  
* generated sections;  
* user edits;  
* questions;  
* learning attempts;  
* automation runs.

This structured history enables more reliable updates than regenerating from unstructured text.

## **4.5 Learning-outcome advantage**

The long-term moat should be evidence that Automatic Library helps users:

* begin studying sooner;  
* find information faster;  
* retain knowledge better;  
* create fewer incorrect notes;  
* spend less time preparing;  
* perform better on meaningful practice.

---

# **5\. Target Users and Jobs to Be Done**

## **5.1 Primary initial user**

A university student who:

* receives weekly slides, readings or lecture transcripts;  
* studies several courses simultaneously;  
* stores files across downloads, cloud drives and learning platforms;  
* wants organised notes but finds manual note preparation time-consuming;  
* needs revision and practice resources before assessments;  
* cares about accuracy and source traceability.

## **5.2 Core job to be done**

When new course material is released, help me transform it into trustworthy learning resources and integrate it with what I have already learned, so I can begin understanding and practising without rebuilding my notes every week.

## **5.3 Secondary jobs**

* Explain an unfamiliar concept using my course material.  
* Find where a theorem, definition or topic was discussed.  
* Compare explanations across lectures or papers.  
* Generate exam-style practice questions.  
* Identify gaps in my notes.  
* Review only concepts I have not practised successfully.  
* Produce a final course revision guide.  
* Export my work without losing structure.

## **5.4 Future personas**

* postgraduate researchers;  
* literature-review teams;  
* educators creating differentiated materials;  
* certification learners;  
* professional training teams;  
* policy and technical-documentation teams.

These personas should not determine the initial product scope.

---

# **6\. Product Principles**

1. **Source material is the evidence layer.**  
2. **Generated material must remain distinguishishable from source material.**  
3. **Automation must be inspectable and reversible.**  
4. **User edits must not be silently overwritten.**  
5. **Folder scope must be predictable.**  
6. **Incremental updating is preferred over full regeneration.**  
7. **The simplest useful default should require minimal configuration.**  
8. **Advanced control should remain available through progressive disclosure.**  
9. **Learning value is more important than the volume of generated content.**  
10. **The product must communicate uncertainty rather than hide it.**  
11. **Users must be able to export and delete their data.**  
12. **Every important system action should be idempotent and auditable.**

---

# **7\. Product Scope and Release Priorities**

## **7.1 P0: Required for the first public product**

* user accounts;  
* private workspaces;  
* nested folders;  
* PDF, PPTX, DOCX and pasted-text ingestion;  
* file validation and duplicate detection;  
* course automation recipe;  
* individual source notes;  
* cumulative living document;  
* folder-scoped search and question answering;  
* source citations;  
* automatic practice-question generation;  
* manual note editing;  
* protected sections;  
* version history;  
* update review and diff;  
* automation activity centre;  
* Markdown and PDF export;  
* processing-status visibility;  
* usage and cost controls;  
* basic subscription support.

## **7.2 P1: Strong post-MVP improvements**

* URLs and web-page ingestion;  
* user-trained note-style profiles;  
* flashcards;  
* spaced repetition;  
* glossary and concept relationships;  
* advanced search filters;  
* Google Drive connection;  
* LMS import;  
* mobile-responsive study mode;  
* automatic revision packs;  
* topic mastery estimation;  
* collaborative sharing;  
* DOCX export;  
* multilingual notes.

## **7.3 P2: Later expansion**

* lecture audio and video transcription;  
* timestamp-grounded citations;  
* visual concept maps;  
* research paper comparison matrices;  
* team and institution workspaces;  
* educator dashboards;  
* offline desktop processing;  
* local model support;  
* advanced folder relocation and re-synthesis;  
* public recipe marketplace;  
* API and developer platform.

## **7.4 Explicitly excluded from the first release**

* native mobile applications;  
* full real-time collaboration;  
* unrestricted autonomous web research;  
* user-trained foundation models;  
* complex graph databases;  
* complete replacement of learning-management systems;  
* automatic assessment grading for high-stakes decisions;  
* C++ microservices without measured performance need.

---

# **8\. Core User Experience**

## **8.1 First-time onboarding**

The user should complete onboarding within approximately three minutes.

### **Step 1: Select a purpose**

* University course  
* Research project  
* Personal learning  
* Other

For the MVP, “University course” receives the most refined flow.

### **Step 2: Create a folder**

Example:

* COMP3027 Algorithms  
* Semester 1  
* Exam date  
* Optional course description

### **Step 3: Choose an automation recipe**

Recommended default:

**Course Companion**

Whenever material is added:

* create source notes;  
* update master notes;  
* update glossary;  
* create practice questions;  
* identify links to earlier material;  
* show a change report.

### **Step 4: Choose note preferences**

A small number of understandable controls:

* concise, balanced or detailed;  
* beginner-friendly, standard or technical;  
* bullets, mixed or paragraph-based;  
* examples: few, normal or many;  
* practice difficulty;  
* preserve original terminology toggle.

### **Step 5: Upload materials**

The system displays processing stages and allows the user to continue browsing.

## **8.2 Normal weekly workflow**

1. User uploads Week 5 lecture slides.  
2. The file appears immediately in the folder.  
3. Background processing begins.  
4. Source notes are generated.  
5. The update planner identifies affected master-note sections.  
6. A proposed update is generated.  
7. Citations and consistency are validated.  
8. Practice questions are created.  
9. The user receives a completion notification.  
10. The user reviews the change summary.  
11. Safe additions may be auto-applied according to the folder policy.  
12. Material changes require explicit review.

## **8.3 Review Changes interface**

The interface should show:

* added sections;  
* modified sections;  
* possible contradictions;  
* new concepts;  
* generated questions;  
* preserved user sections;  
* unsuccessful or uncertain operations.

Actions:

* Accept all safe changes  
* Review individually  
* Reject  
* Edit before accepting  
* Restore previous version

## **8.4 Search experience**

The search bar should accept both retrieval and action-oriented requests.

Examples:

* “Find the lecture that introduced residual graphs.”  
* “Explain max-flow integrality using Weeks 7 and 8.”  
* “Compare the two definitions of NP-hardness.”  
* “Generate difficult questions from Weeks 4–7.”  
* “Show concepts that I have not practised.”  
* “Which source supports this paragraph?”

The selected scope should always remain visible:

* this document;  
* this folder;  
* this folder and descendants;  
* selected folders;  
* complete workspace.

## **8.5 Study experience**

A learner should be able to move between:

* overview;  
* detailed note;  
* source;  
* worked example;  
* practice question;  
* answer explanation;  
* related concept.

The product should minimise context switching.

---

# **9\. Folder and Knowledge-Scope Rules**

## **9.1 Scope inheritance**

Each folder contains:

* sources;  
* generated artefacts;  
* automation recipe;  
* style profile;  
* search scope;  
* permissions;  
* processing policies.

Child folders inherit parent settings unless explicitly overridden.

## **9.2 Default information-flow rules**

* A generated artefact may use sources in its own folder.  
* A parent-level artefact may use sources from descendant folders when enabled.  
* A child artefact does not automatically use sources from sibling folders.  
* Cross-folder generation requires an explicit shared scope.  
* Every artefact records its exact contributing source set.  
* Search results indicate the folder from which each source originated.

## **9.3 Folder relocation**

When moving a folder, offer:

### **Move only**

Preserve sources, artefacts, settings and current scope.

### **Move and inherit new settings**

Move the folder and adopt eligible settings from the new parent.

### **Reanalyse relationships**

Retain existing artefacts while identifying connections with the new context.

### **Merge into parent knowledge**

Allow parent-level living documents and indexes to incorporate the moved folder.

### **Duplicate**

Create an independent copy with new identifiers.

No option should silently rewrite user-owned text.

---

# **10\. Content Ownership Model**

Each generated-document section should have an ownership state.

## **10.1 AI-managed**

The system may update the section automatically under the configured recipe.

## **10.2 User-managed**

The system may read the section for context but cannot modify it without explicit permission.

## **10.3 Shared**

The system may propose changes, but the user must approve them.

## **10.4 Locked**

The section cannot be modified by automation.

## **10.5 Generated snapshot**

A read-only historical version retained for comparison or restoration.

Ownership metadata must remain attached at block or section level rather than only at whole-document level.

---

# **11\. Functional Requirements and Acceptance Criteria**

## **11.1 File ingestion**

### **Requirements**

* Support PDF, PPTX, DOCX, TXT and pasted text.  
* Reject unsupported or dangerous files safely.  
* Detect exact duplicates using content hashes.  
* Detect probable near-duplicates.  
* Extract text, headings, tables and page or slide references.  
* Preserve original files.  
* Record extraction quality.  
* Allow reprocessing with a newer parser.

### **Acceptance criteria**

* Duplicate uploads do not create duplicate embeddings or duplicate notes without user confirmation.  
* Every extracted chunk retains a source location.  
* Failed extraction produces a visible error rather than empty notes.  
* The source remains downloadable in its original form.  
* A retry is safe and does not duplicate downstream data.

## **11.2 Automation recipes**

### **Requirements**

A recipe defines:

* trigger;  
* source filters;  
* output types;  
* note style;  
* destination;  
* update mode;  
* approval mode;  
* question settings;  
* model-quality level;  
* budget limit;  
* notification behaviour.

### **Acceptance criteria**

* Users can preview what a recipe will do.  
* Users can pause or disable a recipe.  
* A recipe run records its version.  
* Repeated delivery of the same upload event does not duplicate outputs.  
* Changed recipe settings apply only prospectively unless reprocessing is requested.

## **11.3 Source notes**

### **Requirements**

Generate structured source-specific notes containing:

* title and metadata;  
* concise overview;  
* learning objectives or central questions;  
* key concepts;  
* detailed sections;  
* definitions;  
* examples;  
* formulas where relevant;  
* uncertainties;  
* citations.

### **Acceptance criteria**

* Every material factual section contains at least one valid source reference.  
* Unsupported details are removed or clearly labelled as external explanation.  
* Notes remain editable.  
* User edits survive later source reprocessing unless explicitly replaced.

## **11.4 Living documents**

### **Requirements**

* Combine information across an approved source scope.  
* Update incrementally.  
* preserve heading stability;  
* preserve user-managed blocks;  
* retain citations;  
* detect affected sections;  
* maintain version history.

### **Acceptance criteria**

* Adding a new source does not modify unrelated sections.  
* Every modification is represented in a diff.  
* The previous version can be restored.  
* The system explains why a section was changed.  
* Deleted source material triggers a review rather than immediate destructive removal.

## **11.5 Search and question answering**

### **Requirements**

* Hybrid keyword and semantic retrieval.  
* Folder-aware permissions.  
* Page- or slide-level citations.  
* Query decomposition for complex questions.  
* Clear insufficient-evidence response.  
* Optional explanation level.  
* Search-result filters.

### **Acceptance criteria**

* Search never returns content from an unauthorised workspace.  
* Citations open the relevant source location where technically possible.  
* When evidence is inadequate, the system says so.  
* Answers distinguish sourced statements from general explanatory material.  
* Retrieval logs retain document identifiers without exposing private text to operational dashboards unnecessarily.

## **11.6 Practice generation**

### **Requirements**

Support:

* recall questions;  
* conceptual questions;  
* application problems;  
* worked problems;  
* multiple choice;  
* short answer;  
* proof or reasoning questions where applicable;  
* configurable difficulty;  
* answer explanations;  
* source references.

### **Acceptance criteria**

* Questions are answerable from the selected scope unless marked as extension questions.  
* Distractors are plausible but not misleading.  
* Answer keys cite supporting material.  
* Duplicate or near-duplicate questions are suppressed.  
* Users can report ambiguity or incorrect answers.  
* Reported questions enter an evaluation queue.

## **11.7 Editing and versioning**

### **Requirements**

* Rich-text or structured-block editing.  
* Autosave.  
* Undo and redo.  
* section locking;  
* comments or annotations;  
* version comparison;  
* restoration.

### **Acceptance criteria**

* User text is never lost after successful save confirmation.  
* Conflicting simultaneous edits produce a recoverable merge state.  
* Restoring a version creates a new version rather than destroying history.  
* AI updates respect block ownership.

## **11.8 Export**

### **Requirements**

* Markdown;  
* PDF;  
* plain text;  
* structured JSON for backup;  
* later DOCX.

### **Acceptance criteria**

* Exported notes retain headings and citations.  
* Export is generated from a stable document version.  
* Users can export all account data.  
* Account deletion and workspace deletion are separate, explicit actions.

---

# **12\. System Architecture**

## **12.1 Recommended technology stack**

### **Frontend**

* Next.js  
* React  
* TypeScript  
* accessible component library  
* structured block editor  
* client-side query cache  
* server-rendered account and library pages where useful

### **Main application layer**

* TypeScript API layer using Next.js server functionality or NestJS  
* schema validation for all requests  
* role-based access control  
* service-layer separation from route handlers

### **AI and document-processing layer**

* Python  
* FastAPI for internal processing APIs where required  
* background workers for extraction, indexing and generation  
* provider-independent model adapter

### **Storage**

* PostgreSQL for relational product data  
* pgvector initially for embeddings  
* S3-compatible object storage for files  
* Redis for caching, rate limiting and short-lived job state  
* durable workflow or queue system for background work

### **Observability**

* structured logs;  
* error tracking;  
* distributed traces;  
* metrics dashboards;  
* AI-generation audit records;  
* cost tracking by operation and user.

## **12.2 Why C++ should not be the primary stack**

The major latency sources will usually be:

* file transfer;  
* parsing;  
* model inference;  
* model API requests;  
* database operations;  
* vector retrieval;  
* queue waiting;  
* object storage.

C++ would increase implementation complexity without necessarily improving user-perceived performance.

C++ should be considered only after profiling identifies a specific CPU-intensive component, such as:

* large-scale local indexing;  
* specialised media processing;  
* native desktop search;  
* high-volume parsing;  
* local inference optimisation.

## **12.3 Deployment model**

### **Initial deployment**

* frontend and web API on a managed web platform;  
* Python workers in managed containers;  
* managed PostgreSQL;  
* managed object storage;  
* managed Redis or workflow service;  
* CDN for static assets;  
* separate development, staging and production environments.

### **Later deployment**

* regional data hosting;  
* dedicated enterprise environments;  
* private-cloud deployments;  
* local processing for sensitive institutions;  
* multi-region read architecture.

---

# **13\. Core Service Boundaries**

## **13.1 Identity service**

Responsible for:

* authentication;  
* sessions;  
* account status;  
* subscription association;  
* deletion requests.

## **13.2 Workspace service**

Responsible for:

* workspaces;  
* folders;  
* permissions;  
* folder movement;  
* scope policies.

## **13.3 Source service**

Responsible for:

* uploads;  
* metadata;  
* source versions;  
* file hashes;  
* processing status;  
* download authorisation.

## **13.4 Extraction service**

Responsible for:

* parser selection;  
* text extraction;  
* layout extraction;  
* page and slide mapping;  
* extraction-quality reporting.

## **13.5 Knowledge-index service**

Responsible for:

* chunking;  
* embedding;  
* keyword indexing;  
* concepts;  
* relationships;  
* retrieval.

## **13.6 Generation service**

Responsible for:

* summaries;  
* notes;  
* questions;  
* explanations;  
* structured output validation;  
* citations.

## **13.7 Update planner**

Responsible for:

* identifying affected sections;  
* comparing new and existing knowledge;  
* generating update plans;  
* preserving ownership;  
* creating proposed diffs.

## **13.8 Automation service**

Responsible for:

* triggers;  
* recipe execution;  
* idempotency;  
* retries;  
* budget enforcement;  
* automation history.

## **13.9 Learning service**

Responsible for:

* question attempts;  
* learner confidence;  
* review scheduling;  
* progress evidence;  
* weak-topic identification.

---

# **14\. Core Data Model**

## **14.1 Primary entities**

### **User**

* id  
* account state  
* locale  
* timezone  
* preferences  
* created\_at  
* deletion state

### **Workspace**

* id  
* owner  
* name  
* plan  
* region  
* privacy settings

### **WorkspaceMember**

* user  
* workspace  
* role  
* invitation state

### **Folder**

* id  
* workspace  
* parent\_folder  
* name  
* inherited\_settings  
* scope policy  
* deleted\_at

### **Source**

* id  
* folder  
* type  
* original filename  
* content hash  
* processing state  
* extraction quality  
* active version

### **SourceVersion**

* source  
* version number  
* object-storage reference  
* parser version  
* uploaded\_at

### **SourceChunk**

* source version  
* text  
* structural type  
* page, slide or timestamp  
* embedding  
* token count  
* checksum

### **Concept**

* workspace  
* canonical name  
* aliases  
* description  
* confidence

### **ConceptOccurrence**

* concept  
* source chunk  
* relationship type  
* confidence

### **GeneratedArtifact**

* folder  
* type  
* title  
* source scope  
* recipe version  
* current version

### **ArtifactVersion**

* artifact  
* generation method  
* created\_at  
* status  
* approval state

### **ArtifactBlock**

* artifact version  
* stable block identifier  
* parent block  
* content  
* ownership state  
* order  
* generation metadata

### **Citation**

* artifact block  
* source chunk  
* support type  
* confidence

### **AutomationRecipe**

* folder  
* version  
* trigger  
* configuration  
* active state

### **AutomationRun**

* recipe version  
* trigger event  
* state  
* cost  
* outputs  
* errors  
* timestamps

### **PracticeQuestion**

* folder  
* source scope  
* type  
* difficulty  
* prompt  
* answer  
* explanation  
* validation state

### **LearningAttempt**

* user  
* question  
* response  
* score  
* confidence  
* attempted\_at

### **StyleProfile**

* user or folder  
* explicit settings  
* inferred settings  
* example sources  
* version

### **AuditEvent**

* actor  
* workspace  
* action  
* target  
* timestamp  
* request identifier

---

# **15\. Event-Driven Processing Pipeline**

## **15.1 Upload pipeline**

1. User requests an upload.  
2. Server validates permission and file metadata.  
3. Client uploads directly to object storage using a short-lived signed URL.  
4. Source record is created.  
5. Malware and format validation runs.  
6. Content hash is calculated.  
7. Duplicate policy is evaluated.  
8. Extraction begins.  
9. Extracted structure is normalised.  
10. Chunks are created.  
11. Keyword index and embeddings are generated.  
12. Concepts and metadata are extracted.  
13. Eligible automation recipes are identified.  
14. Automation runs are created.  
15. Notes and update plans are generated.  
16. Outputs are validated.  
17. New artefact versions are stored.  
18. The user is notified.

## **15.2 Required event properties**

Every event should include:

* unique event identifier;  
* workspace identifier;  
* source identifier;  
* event type;  
* schema version;  
* creation timestamp;  
* correlation identifier;  
* retry count.

Consumers must be idempotent.

## **15.3 Example events**

* SourceUploaded  
* SourceValidated  
* SourceExtractionCompleted  
* SourceIndexed  
* RecipeTriggered  
* SourceNotesGenerated  
* LivingDocumentUpdateProposed  
* PracticeSetGenerated  
* AutomationRunFailed  
* ArtifactVersionApproved  
* SourceDeleted

---

# **16\. AI and Retrieval Architecture**

## **16.1 Treat source content as untrusted input**

Uploaded documents may contain:

* instructions directed at the model;  
* malicious prompt injection;  
* irrelevant boilerplate;  
* hidden text;  
* incorrect claims;  
* copyrighted content;  
* personal information.

The application must not allow source text to override system or workspace policies.

Prompt injection and other LLM-specific vulnerabilities should be included in the security threat model, following current OWASP guidance for generative-AI applications.

## **16.2 Extraction**

Prefer deterministic extraction before using language models.

Extract:

* paragraphs;  
* headings;  
* lists;  
* tables;  
* captions;  
* footnotes;  
* page and slide references;  
* document metadata.

OCR should be used only when necessary and should record confidence.

## **16.3 Chunking**

Use structure-aware chunks rather than fixed token windows alone.

Chunks should:

* remain associated with headings;  
* preserve page references;  
* avoid splitting formulas or definitions unnecessarily;  
* include limited neighbouring context;  
* maintain stable checksums where possible.

## **16.4 Retrieval**

Use hybrid retrieval:

* keyword search;  
* semantic vector search;  
* metadata filters;  
* heading and concept matches;  
* recency or course-order weighting where relevant;  
* optional reranking.

Retrieval must apply permission and folder-scope filters before content is passed to the model.

## **16.5 Generation**

Generation prompts should request structured output with validated schemas.

Outputs should separate:

* claims directly supported by sources;  
* synthesis across sources;  
* explanatory additions;  
* uncertain interpretations;  
* detected contradictions.

## **16.6 Citation validation**

For each generated claim:

1. Identify supporting chunks.  
2. Calculate textual or semantic support.  
3. Reject citations that do not support the claim.  
4. Regenerate or weaken unsupported wording.  
5. Label external explanations separately.  
6. Retain the support relationship in the database.

## **16.7 Update planning**

The update planner should not ask a model to rewrite the complete living document by default.

It should:

1. Compare new concepts with existing concepts.  
2. Identify potentially affected blocks.  
3. retrieve those blocks and relevant source chunks;  
4. classify the update as append, expand, correct, conflict or no action;  
5. inspect ownership rules;  
6. generate block-level proposals;  
7. validate citations;  
8. produce a diff;  
9. request approval according to policy.

## **16.8 Style personalisation**

Style adaptation should initially use:

* explicit user settings;  
* selected example notes;  
* accepted-generation patterns;  
* lightweight style descriptors.

Avoid fine-tuning a model in the MVP.

The style profile should describe presentation rather than factual behaviour. Personalisation must not reduce citation quality or encourage unsupported compression.

## **16.9 Model routing**

Use different tools for different tasks.

### **Deterministic code**

* validation;  
* hashing;  
* permissions;  
* file operations;  
* diffing;  
* scheduling;  
* structured calculations.

### **Small or low-cost models**

* classification;  
* metadata extraction;  
* heading detection;  
* simple summaries;  
* duplicate-question checks.

### **Stronger models**

* cross-source synthesis;  
* complex explanations;  
* update reasoning;  
* advanced practice problems;  
* contradiction analysis.

The model provider must be replaceable through an abstraction layer.

---

# **17\. AI Quality Evaluation**

## **17.1 Evaluation dataset**

Create a versioned internal evaluation set containing:

* lecture slides;  
* readings;  
* technical documents;  
* tables;  
* diagrams;  
* conflicting sources;  
* badly extracted PDFs;  
* duplicate files;  
* adversarial prompt-injection documents;  
* documents containing irrelevant instructions.

Have subject-knowledgeable reviewers create reference outputs.

## **17.2 Core AI metrics**

### **Citation validity**

Percentage of citations that genuinely support the associated claim.

**Initial release target:** at least 95% on the evaluation set.

### **Claim groundedness**

Percentage of factual claims supported by selected sources or clearly labelled external explanations.

**Initial release target:** at least 95%.

### **Important-point recall**

Percentage of reviewer-identified essential concepts represented in generated notes.

**Initial target:** at least 85%.

### **Contradiction precision**

Percentage of flagged contradictions that are meaningful rather than superficial wording differences.

**Initial target:** at least 80%.

### **Update locality**

Percentage of changes limited to genuinely affected sections.

**Initial target:** at least 95%.

### **User-edit preservation**

Percentage of protected user content retained correctly.

**Required target:** 100% in automated tests.

### **Question validity**

Percentage of generated questions judged answerable, unambiguous and correctly keyed.

**Initial target:** at least 90%.

## **17.3 Human feedback**

Users should be able to mark:

* useful;  
* too shallow;  
* too detailed;  
* incorrect;  
* unsupported;  
* wrong citation;  
* poor question;  
* style mismatch.

Feedback should be attached to the generation version, model, recipe and source scope.

## **17.4 Release gates**

A new model or prompt version should not reach all users until it passes:

* automated schema validation;  
* regression evaluations;  
* citation evaluation;  
* prompt-injection evaluation;  
* cost comparison;  
* latency comparison;  
* limited canary deployment.

---

# **18\. Security and Privacy**

## **18.1 Security baseline**

Use current OWASP web-application and generative-AI security guidance as baseline references.

Protect against:

* broken access control;  
* insecure direct-object references;  
* injection;  
* prompt injection;  
* cross-workspace retrieval;  
* malicious file uploads;  
* excessive model agency;  
* sensitive-information disclosure;  
* insecure output handling;  
* supply-chain vulnerabilities;  
* denial-of-service and cost exhaustion;  
* credential leakage;  
* session theft.

## **18.2 File security**

* file-size limits;  
* MIME-type validation;  
* extension and content verification;  
* malware scanning;  
* quarantine before processing;  
* archive-bomb protection;  
* parser isolation;  
* signed download URLs;  
* restricted object-storage permissions.

## **18.3 Access control**

* workspace-level roles;  
* folder-level permissions later;  
* server-side permission checks;  
* no reliance on hidden UI controls;  
* tenant identifier required in every relevant query;  
* automated cross-tenant security tests.

## **18.4 Data protection**

* encryption in transit;  
* encryption at rest;  
* managed secret storage;  
* key rotation;  
* minimal production access;  
* audit logs;  
* regular backups;  
* tested restoration;  
* configurable retention;  
* deletion workflows.

## **18.5 AI-provider privacy**

Users must be told:

* which providers process their content;  
* whether content is retained;  
* whether it is used for provider training;  
* where processing occurs;  
* which controls are available.

Provider contracts should prohibit training on private customer content unless the user explicitly opts in.

## **18.6 Privacy by design**

Privacy should be incorporated into architecture and business processes from the beginning rather than added after launch. Australian privacy guidance also states that privacy obligations can apply to personal information used with AI systems, and the Australian Privacy Principles govern collection, use, disclosure and management of personal information.

Required controls:

* collect only necessary information;  
* clear privacy notices;  
* consent for optional data use;  
* workspace export;  
* account deletion;  
* model-training opt-in rather than opt-out;  
* separate analytics from document content where possible;  
* privacy impact assessment before major integrations.

## **18.7 AI risk governance**

Use a lightweight internal governance process aligned with NIST’s AI Risk Management Framework functions: govern, map, measure and manage.

Maintain:

* AI system inventory;  
* intended uses;  
* prohibited uses;  
* known limitations;  
* evaluation reports;  
* model-change history;  
* incident process;  
* risk owners;  
* user-feedback monitoring.

---

# **19\. Accessibility and International Use**

Target **WCAG 2.2 Level AA** for the web application. WCAG 2.2 provides testable accessibility criteria across perceivable, operable, understandable and robust interfaces.

Required considerations:

* complete keyboard navigation;  
* visible focus indicators;  
* sufficient contrast;  
* scalable text;  
* screen-reader labels;  
* accessible document structure;  
* non-colour status indicators;  
* captions and transcripts for media;  
* reduced-motion support;  
* accessible drag-and-drop alternatives;  
* generous click targets;  
* plain-language error messages;  
* localisation-ready layouts;  
* right-to-left language support later;  
* selectable output language independent of source language.

---

# **20\. Reliability and Operations**

## **20.1 Initial service objectives**

### **Web availability**

Target: 99.9% monthly after stable public launch.

### **Upload acknowledgement**

Target: 95% within two seconds, excluding file-transfer time.

### **Search latency**

Target: 95% of ordinary searches under two seconds before answer generation.

### **Processing reliability**

Target: at least 99% of supported, valid documents reach a terminal success or visible actionable-failure state.

### **Data durability**

Use managed storage and backups appropriate to the selected provider.

### **User-edit safety**

No confirmed user edit may be lost because of an AI update.

## **20.2 Retry policy**

* exponential backoff;  
* bounded retries;  
* dead-letter queue;  
* actionable user state;  
* manual retry;  
* idempotent operations.

## **20.3 Observability**

Track:

* request latency;  
* error rate;  
* queue depth;  
* worker duration;  
* model latency;  
* token usage;  
* model cost;  
* extraction quality;  
* citation failures;  
* retrieval misses;  
* automation failures;  
* user acceptance of changes;  
* export failures.

Logs must avoid unnecessary source-content exposure.

---

# **21\. Testing Strategy**

## **21.1 Unit tests**

Cover:

* folder-scope resolution;  
* ownership rules;  
* permission checks;  
* recipe inheritance;  
* idempotency keys;  
* version transitions;  
* cost limits;  
* diff generation.

## **21.2 Integration tests**

Cover:

* upload to extraction;  
* extraction to indexing;  
* indexing to retrieval;  
* recipe trigger to artefact;  
* user edit to later AI update;  
* deletion and restoration;  
* subscription enforcement.

## **21.3 End-to-end tests**

Cover complete user journeys:

* create course;  
* upload lecture;  
* review generated note;  
* edit and lock section;  
* upload another lecture;  
* verify preserved edit;  
* ask cited question;  
* generate practice;  
* export notes.

## **21.4 AI regression tests**

Run against the fixed evaluation corpus for every:

* prompt update;  
* model update;  
* chunking update;  
* reranker update;  
* citation-validator update;  
* extraction update.

## **21.5 Security tests**

* dependency scanning;  
* secret scanning;  
* static analysis;  
* dynamic application tests;  
* cross-tenant access tests;  
* malicious file tests;  
* prompt-injection tests;  
* rate-limit tests;  
* permission fuzzing;  
* penetration testing before institutional launch.

## **21.6 Performance tests**

Test:

* concurrent uploads;  
* very large folders;  
* large cumulative documents;  
* queue spikes before examinations;  
* search across thousands of chunks;  
* retry storms;  
* model-provider outages.

## **21.7 Accessibility tests**

Use:

* automated accessibility checks;  
* keyboard-only testing;  
* screen-reader testing;  
* contrast testing;  
* zoom and responsive testing;  
* user testing with people who have varied access needs.

---

# **22\. Cost Architecture**

## **22.1 Major cost categories**

* model tokens;  
* embeddings;  
* OCR;  
* transcription;  
* file storage;  
* database;  
* background compute;  
* search infrastructure;  
* monitoring;  
* customer support;  
* payment fees.

## **22.2 Cost-control mechanisms**

* content hashing;  
* duplicate suppression;  
* incremental updates;  
* chunk-level caching;  
* reuse of extracted structures;  
* batch embeddings;  
* model routing;  
* maximum context limits;  
* per-recipe budgets;  
* user quotas;  
* summary hierarchy;  
* deferred optional generation;  
* archive policies;  
* rate limiting.

## **22.3 Cost visibility**

Track cost by:

* user;  
* workspace;  
* source;  
* automation run;  
* artefact;  
* model;  
* feature.

Do not launch unlimited automation until real usage distributions are understood.

---

# **23\. Pricing Hypothesis**

Pricing must be validated rather than assumed.

## **Free**

* limited storage;  
* limited monthly processing;  
* one or two active course folders;  
* basic notes;  
* limited questions;  
* community support.

## **Student Plus**

* more active courses;  
* cumulative living documents;  
* higher processing allowance;  
* advanced note styles;  
* exports;  
* practice history;  
* priority processing.

## **Research or Professional**

* larger documents;  
* cross-source synthesis;  
* advanced comparison;  
* more storage;  
* collaboration;  
* stronger privacy controls.

## **Institution**

Later:

* administrative controls;  
* SSO;  
* regional hosting;  
* audit logs;  
* contractual data terms;  
* central billing;  
* usage reporting;  
* private deployment options.

Avoid setting final prices until willingness-to-pay interviews and model-cost testing are completed.

---

# **24\. Go-to-Market Strategy**

## **24.1 Initial audience**

University students in technically demanding or content-heavy courses.

## **24.2 Initial message**

Upload your weekly course material once. Your notes, glossary and practice set stay updated automatically.

## **24.3 Acquisition channels**

* university student communities;  
* study and productivity communities;  
* course-focused Discord groups where permitted;  
* student societies;  
* demonstration videos;  
* founder-led onboarding;  
* campus ambassadors later;  
* referral rewards;  
* public example course workspaces using non-copyrighted material.

## **24.4 Activation event**

A user is considered activated when they:

1. create a course folder;  
2. upload at least two sources;  
3. generate source notes;  
4. receive one cumulative update;  
5. open or accept the update.

## **24.5 Retention mechanism**

The strongest retention event should be:

User uploads the next week’s material into the same course.

The product should remind users about inactive courses carefully, without creating notification fatigue.

## **24.6 Validation interviews**

Before broad launch, conduct interviews with:

* students who take extensive notes;  
* students who rarely take notes because of effort;  
* users of NotebookLM;  
* users of RemNote or Anki;  
* users of StudyFetch;  
* students who rely on ChatGPT and folders;  
* accessibility-focused learners.

Questions should focus on actual past behaviour rather than hypothetical enthusiasm.

---

# **25\. Product Metrics**

## **25.1 North-star metric**

**Weekly learning resources actively used from continuously maintained folders.**

This is stronger than counting generated words or uploads.

## **25.2 Activation metrics**

* percentage creating first folder;  
* percentage uploading first source;  
* percentage completing first automation;  
* percentage reviewing first update;  
* time to first useful artefact.

## **25.3 Retention metrics**

* weekly active learners;  
* second-week upload rate;  
* four-week course retention;  
* number of active course folders;  
* study-session frequency.

## **25.4 Value metrics**

* estimated manual time saved;  
* update acceptance rate;  
* search success rate;  
* citation-open rate;  
* practice completion;  
* export rate;  
* user-reported clarity.

## **25.5 Quality metrics**

* citation validity;  
* groundedness;  
* user-reported inaccuracies;  
* regeneration rate;  
* question-report rate;  
* user-edit overwrite incidents;  
* processing failures.

## **25.6 Business metrics**

* free-to-paid conversion;  
* revenue per paying user;  
* model cost per active user;  
* gross margin;  
* churn;  
* support cost;  
* acquisition cost.

---

# **26\. Development Roadmap**

## **Phase 0: Discovery and technical proof**

### **Objective**

Validate the need and prove reliable source-grounded generation.

### **Work**

* 15–25 user interviews;  
* competitor workflow testing;  
* clickable prototype;  
* extraction proof for PDF and PPTX;  
* source-grounded note prototype;  
* citation evaluation set;  
* preliminary cost model.

### **Exit criteria**

* users consistently identify ongoing course maintenance as a real problem;  
* at least five target users agree to test weekly;  
* notes achieve acceptable citation and coverage quality;  
* expected processing cost is compatible with plausible pricing.

## **Phase 1: Private alpha**

### **Objective**

Deliver one complete course workflow.

### **Features**

* accounts;  
* one workspace;  
* folders;  
* uploads;  
* course recipe;  
* source notes;  
* basic master note;  
* citations;  
* simple search;  
* automation status;  
* manual editing.

### **Exit criteria**

* 20 active testers;  
* no unresolved user-edit loss;  
* acceptable source-note quality;  
* weekly repeat upload behaviour;  
* core workflow completion without founder intervention.

## **Phase 2: Closed beta**

### **Objective**

Make continuous updates trustworthy.

### **Features**

* block ownership;  
* incremental update planner;  
* diffs;  
* version restoration;  
* practice questions;  
* usage tracking;  
* payment test;  
* accessibility improvements;  
* improved evaluation framework.

### **Exit criteria**

* 100 active testers;  
* meaningful four-week retention;  
* high update acceptance;  
* citation target achieved;  
* stable cost per active user;  
* no cross-workspace security incidents.

## **Phase 3: Public beta**

### **Objective**

Launch a reliable self-service student product.

### **Features**

* polished onboarding;  
* billing;  
* exports;  
* improved search;  
* support centre;  
* account deletion;  
* monitoring and alerting;  
* referral system;  
* mobile-responsive study experience.

### **Exit criteria**

* healthy activation;  
* sustainable paid conversion;  
* acceptable support burden;  
* stable reliability;  
* documented security review.

## **Phase 4: Learning intelligence**

### **Objective**

Improve learning value rather than only document generation.

### **Features**

* flashcards;  
* spaced repetition;  
* weak-topic detection;  
* question history;  
* revision packs;  
* exam-mode workflows;  
* better personalisation.

## **Phase 5: Research and professional expansion**

### **Features**

* research recipes;  
* literature matrices;  
* paper comparison;  
* contradiction tracking;  
* collaborative workspaces;  
* advanced permissions;  
* integrations.

---

# **27\. Initial 12-Week Build Sequence**

## **Weeks 1–2: Foundation**

* repository structure;  
* environments;  
* authentication;  
* database migrations;  
* workspace and folder entities;  
* object-storage upload;  
* logging and error tracking.

## **Weeks 3–4: Ingestion**

* PDF extraction;  
* PPTX extraction;  
* DOCX extraction;  
* source metadata;  
* hashing;  
* duplicate detection;  
* processing states;  
* chunk model.

## **Weeks 5–6: Search and citations**

* embeddings;  
* keyword search;  
* scope filters;  
* retrieval;  
* cited question answering;  
* citation navigation;  
* evaluation harness.

## **Weeks 7–8: Generated notes**

* course recipe;  
* structured source notes;  
* artefact storage;  
* block editor;  
* versioning;  
* source-note quality evaluation.

## **Weeks 9–10: Living documents**

* concept matching;  
* affected-block retrieval;  
* update planner;  
* block ownership;  
* diff review;  
* restoration.

## **Weeks 11–12: Practice and private alpha**

* practice generation;  
* answer validation;  
* automation activity centre;  
* onboarding;  
* basic usage controls;  
* security review;  
* alpha onboarding.

The schedule is a sequencing framework, not a promise that one developer must complete production quality within 12 weeks.

---

# **28\. Team Requirements**

## **Initial founder or small-team roles**

### **Product and UX**

* user research;  
* workflow design;  
* accessibility;  
* onboarding;  
* product analytics.

### **Full-stack engineering**

* frontend;  
* API;  
* database;  
* authentication;  
* billing;  
* editor;  
* folder system.

### **AI and backend engineering**

* extraction;  
* retrieval;  
* generation;  
* evaluation;  
* job processing;  
* cost optimisation.

### **Security and privacy**

Initially supported through expert review rather than necessarily a full-time role.

### **Subject-matter review**

Part-time reviewers for evaluation of generated notes and questions.

A capable solo developer can build the alpha, but production launch requires careful prioritisation and external review in security, privacy and accessibility.

---

# **29\. Major Risks and Mitigations**

## **Risk: Becoming a generic summariser**

**Mitigation:** Prioritise continuous updates, edit preservation and folder recipes before broad generation features.

## **Risk: Hallucinated or misleading notes**

**Mitigation:** Source-bound generation, citation validation, groundedness evaluation and uncertainty labels.

## **Risk: User edits are overwritten**

**Mitigation:** Block ownership, immutable version history and explicit diff approval.

## **Risk: High AI costs**

**Mitigation:** Incremental updates, caching, routing, quotas and task-specific models.

## **Risk: Users upload copyrighted or confidential material**

**Mitigation:** private-by-default storage, terms of use, controlled sharing, deletion tools and provider contracts.

## **Risk: Folder logic becomes confusing**

**Mitigation:** simple defaults, visible scope indicators, impact previews and progressive disclosure.

## **Risk: Generated study questions are poor**

**Mitigation:** question validation, citation requirements, user reporting and quality thresholds.

## **Risk: Competitors copy automation features**

**Mitigation:** build superior user history, structured knowledge state, update reliability, personalisation and learning-outcome evidence.

## **Risk: Students outsource learning rather than learn**

**Mitigation:** prioritise explanation, retrieval practice and guided problem solving rather than answer dumping.

## **Risk: Overbuilding before validation**

**Mitigation:** require stage exit criteria and measure weekly reuse before adding advanced media or institutional features.

---

# **30\. Anti-Features**

Automatic Library should deliberately avoid:

* hiding source uncertainty;  
* producing enormous notes by default;  
* automatically merging unrelated folders;  
* rewriting manually edited text without review;  
* claiming mastery from page views;  
* encouraging blind acceptance of AI answers;  
* using user documents for training without explicit consent;  
* making destructive automation irreversible;  
* exposing complex model settings to beginners;  
* adding social or gamification features without demonstrated learning value;  
* generating resources merely to increase perceived feature count.

---

# **31\. Definition of a Successful MVP**

The MVP is successful when a target student can:

1. Create a course folder without assistance.  
2. Upload weekly materials.  
3. Receive useful notes grounded in those materials.  
4. Find the original evidence for important claims.  
5. Edit and protect their own explanations.  
6. Upload later material without losing earlier edits.  
7. Review exactly what the system changed.  
8. Generate valid practice questions.  
9. locate information faster than through ordinary file browsing;  
10. return the following week because the maintained workspace is more valuable than beginning again elsewhere.

The MVP is not successful merely because it can call an AI model, generate attractive summaries or demonstrate many output formats.

---

# **32\. Final Product Standard**

Automatic Library should be considered ready for serious public adoption only when it is:

* useful without extensive prompting;  
* reliable across normal course documents;  
* transparent about evidence;  
* safe for private materials;  
* respectful of user ownership;  
* cost-controlled;  
* accessible;  
* recoverable after failures;  
* measurable in learning value;  
* simple enough for a new user to understand;  
* powerful enough to remain useful for an entire semester.

Its long-term vision is:

To give every learner a trustworthy knowledge system that organises itself, grows with their progress and turns difficult information into a clear path from first exposure to confident understanding.

