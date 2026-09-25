import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import os from 'os';
import fs from 'fs';
import https from 'https';
import { Jimp } from 'jimp';
import { spawn } from 'child_process';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SECONDARY_GROQ_API_KEY = process.env.SECONDARY_GROQ_API_KEY;

// Mock database of questions for fallback mode (includes keywords and idealAnswers)
const MOCK_DATA = {
  'javascript': [
    {
      question: "Could you explain the difference between 'let', 'const', and 'var', and what block scoping means?",
      idealAnswer: "var is function-scoped, can be re-declared, and is hoisted with undefined. let and const are block-scoped (only accessible inside the enclosing { }), cannot be re-declared in the same scope, and are hoisted to the Temporal Dead Zone (TDZ). const additionally cannot be reassigned after declaration.",
      keywords: ['scope', 'block', 'hoist', 'reassign', 'var', 'let', 'const']
    },
    {
      question: "What is the event loop in JavaScript, and how does it handle asynchronous operations?",
      idealAnswer: "The Event Loop enables non-blocking, single-threaded execution. Synchronous code runs in the Call Stack. Asynchronous tasks (like setTimeout, fetch) are handled by Web APIs and queued in the Callback/Task Queue or Microtask Queue. When the Call Stack is empty, the Event Loop pushes tasks from the queues into the stack for execution.",
      keywords: ['loop', 'stack', 'queue', 'async', 'single', 'thread', 'callback', 'promise']
    },
    {
      question: "Can you explain what a closure is and provide a practical use case for it?",
      idealAnswer: "A closure is a function that retains access to its lexical scope even when executed outside that scope. It is created when an inner function references variables in an outer function. Practical use cases include data privacy (hiding variables from external access) and partial application/currying.",
      keywords: ['scope', 'inner', 'outer', 'function', 'lexical', 'remember', 'access']
    },
    {
      question: "What is the difference between '==' and '===' in JavaScript, and why is one preferred?",
      idealAnswer: "== performs type coercion before comparing two values (converting them to a common type first), while === compares both the value and the type strictly without coercion. === is preferred to avoid unexpected coercion bugs (e.g. true == 1 is true, but true === 1 is false).",
      keywords: ['type', 'value', 'strict', 'equality', 'conversion', 'coerce']
    },
    {
      question: "How do promises work, and how does async/await syntax improve asynchronous code readability?",
      idealAnswer: "Promises represent the eventual completion or failure of an asynchronous operation. They have three states: Pending, Resolved, or Rejected. async/await is syntactic sugar over promises, allowing asynchronous code to be written sequentially and handled like synchronous code using try/catch, removing nested 'then/catch' chains.",
      keywords: ['resolve', 'reject', 'pending', 'async', 'await', 'then', 'catch']
    },
    {
      question: "What is the difference between synchronous and asynchronous code execution in JavaScript, and how does the browser event loop prevent blocking?",
      idealAnswer: "Synchronous code executes sequentially, blocking subsequent tasks until the current one finishes. Asynchronous code executes non-sequentially, offloading long-running tasks to the browser APIs and queuing callback tasks in the queue to run later when the call stack is empty. This prevents blocking the single main thread.",
      keywords: ['synchronous', 'asynchronous', 'block', 'non-blocking', 'thread', 'stack', 'queue']
    },
    {
      question: "Can you explain prototypal inheritance in JavaScript and how it differs from class-based inheritance?",
      idealAnswer: "Prototypal inheritance means objects inherit properties and methods directly from other objects via a prototype link (`__proto__`), forming a prototype chain. Class-based inheritance uses blueprints (classes) to create instances. JavaScript classes are syntactic sugar over prototypes.",
      keywords: ['prototype', 'inheritance', 'chain', 'class', 'sugar', 'delegate']
    },
    {
      question: "What are arrow functions, and how do they differ from regular functions regarding the 'this' context?",
      idealAnswer: "Arrow functions have a shorter syntax and do not bind their own 'this' value; instead, they inherit 'this' lexically from their enclosing scope. Regular functions bind 'this' dynamically based on how they are called (e.g., as a method, function, or constructor).",
      keywords: ['arrow', 'regular', 'function', 'this', 'lexical', 'bind', 'context']
    },
    {
      question: "What is the difference between map, filter, and reduce methods on JavaScript arrays?",
      idealAnswer: "map creates a new array by transforming each element. filter creates a new array containing only elements that pass a conditional test. reduce executes a reducer function on each element, accumulating them into a single final value (e.g., number, object, or array).",
      keywords: ['map', 'filter', 'reduce', 'array', 'transform', 'accumulate', 'element']
    },
    {
      question: "What is the Temporal Dead Zone (TDZ) in JavaScript, and how does it relate to hoisting?",
      idealAnswer: "The TDZ is the period between a variable's block entry and its actual declaration. Variables declared with let and const are hoisted but not initialized, remaining in the TDZ. Accessing them before their declaration line throws a ReferenceError.",
      keywords: ['temporal', 'dead', 'zone', 'tdz', 'hoist', 'let', 'const', 'referenceerror']
    }
  ],
  'react': [
    {
      question: "What are the main advantages of React's virtual DOM, and how does reconciliation work?",
      idealAnswer: "The Virtual DOM is an in-memory representation of the real DOM. When state changes, React creates a new virtual tree, compares it with the previous virtual tree (Diffing), and updates only the changed nodes in the real DOM (Reconciliation). This minimizes expensive direct DOM manipulations, enhancing UI performance.",
      keywords: ['diff', 'reconcile', 'dom', 'update', 'ui', 'render', 'tree']
    },
    {
      question: "Could you explain the difference between controlled and uncontrolled components?",
      idealAnswer: "Controlled components have their form state driven by React state via props (value and onChange handler), making React the single source of truth. Uncontrolled components store state in the DOM itself, and React accesses their values using refs (e.g. useRef) when needed, which is useful for simpler forms or third-party integrations.",
      keywords: ['state', 'ref', 'input', 'form', 'dom', 'value', 'change']
    },
    {
      question: "What are React Hooks, and what rules must be followed when using hooks like useEffect?",
      idealAnswer: "Hooks are functions that let you use state and other React features in functional components. The core rules of hooks are: 1) Only call hooks at the top level (never inside loops, conditions, or nested functions) to ensure consistent call order. 2) Only call hooks from React function components or custom hooks.",
      keywords: ['hook', 'state', 'effect', 'render', 'dependency', 'clean', 'mount']
    },
    {
      question: "How does context API differ from state management tools like Redux, and when would you use each?",
      idealAnswer: "Context API is a built-in React feature for passing data down the component tree without manual prop-drilling, suitable for low-frequency updates like themes or auth. Redux is an external library using a global store, actions, and reducers, designed for complex, high-frequency state updates, caching, middleware integration, and time-travel debugging.",
      keywords: ['store', 'provider', 'global', 'reducer', 'action', 'prop', 'drill']
    },
    {
      question: "What is the purpose of React.memo, and how does it optimize rendering performance?",
      idealAnswer: "React.memo is a higher-order component that memoizes functional components. It prevents a component from re-rendering if its props have not changed, performing a shallow comparison of props by default. It is useful for pure components that render frequently with the same props.",
      keywords: ['memo', 'prop', 're-render', 'render', 'prev', 'next', 'compare']
    },
    {
      question: "How does React's virtual DOM diffing algorithm optimize updates, and what role do 'keys' play in list rendering?",
      idealAnswer: "React's diffing algorithm compares two virtual DOM trees element-by-element. Keys help React identify which list items have changed, been added, or been removed, preventing unnecessary re-renders of unmodified siblings and maintaining correct component state.",
      keywords: ['diff', 'key', 'render', 'list', 're-render', 'state', 'sibling']
    },
    {
      question: "What is the difference between useEffect, useMemo, and useCallback hooks, and when would you use each?",
      idealAnswer: "useEffect runs side effects after rendering. useMemo memoizes a computed value to avoid expensive calculations on every render. useCallback memoizes a function definition to prevent unnecessary child re-renders due to fresh function reference generation.",
      keywords: ['effect', 'memo', 'callback', 'render', 'hook', 'reference', 'expensive']
    },
    {
      question: "What is prop-drilling, and how do Context API or custom state libraries resolve it?",
      idealAnswer: "Prop-drilling is the practice of passing props through multiple levels of intermediate components that do not need the data. Context API solves this by providing a Provider wrapper that lets children consume state directly via useContext, bypassing intermediate nodes.",
      keywords: ['prop', 'drill', 'context', 'provider', 'consume', 'intermediate', 'tree']
    },
    {
      question: "What are React custom hooks, and why would you create one?",
      idealAnswer: "Custom hooks are JavaScript functions starting with 'use' that call other hooks. They enable extracting component logic into reusable, testable functions, allowing different components to share stateful logic without duplicating code.",
      keywords: ['custom', 'hook', 'reusable', 'extract', 'logic', 'share', 'stateful']
    },
    {
      question: "What is the difference between useEffect's empty dependency array `[]` and not providing a dependency array at all?",
      idealAnswer: "An empty dependency array `[]` tells React to run the effect only once after the initial mount. Providing no dependency array at all tells React to run the effect after *every single render* of the component.",
      keywords: ['dependency', 'array', 'render', 'mount', 'run', 'effect', 'every']
    }
  ],
  'node': [
    {
      question: "What is Node.js, and how does its non-blocking event-driven I/O model work?",
      idealAnswer: "Node.js is a runtime environment built on Chrome's V8 engine that runs JavaScript server-side. Its non-blocking I/O model delegates long-running tasks (like database queries or file system reads) to the system kernel or thread pool (via libuv). Once finished, the task triggers a callback on the event loop, letting Node handle thousands of concurrent requests on a single main thread.",
      keywords: ['loop', 'event', 'async', 'single', 'thread', 'callback', 'non-blocking']
    },
    {
      question: "What are Streams in Node.js, and what are the benefits of piping streams?",
      idealAnswer: "Streams are collections of data that are read or written sequentially in chunks, rather than loading the entire file into memory at once. Piping streams connects a readable stream directly to a writable stream, managing backpressure automatically and dramatically reducing memory consumption for large file transactions.",
      keywords: ['stream', 'pipe', 'chunk', 'memory', 'buffer', 'read', 'write']
    },
    {
      question: "Can you explain how middleware works in Express.js and give an example of custom middleware?",
      idealAnswer: "Middleware functions in Express have access to the Request (req) and Response (res) objects, and the next middleware function in the cycle (next). They can run code, modify req/res objects, end the request cycle, or pass control using next(). Example: a logger middleware doing `console.log(req.url); next();`.",
      keywords: ['request', 'response', 'next', 'req', 'res', 'cycle', 'route']
    },
    {
      question: "How do you handle error propagation in asynchronous Node.js operations?",
      idealAnswer: "In async operations, errors are handled by: 1) passing them as the first argument in error-first callbacks, 2) catching them in promise chains using .catch(), or 3) enclosing async/await code in try/catch blocks. In Express, you pass async errors to next(err) so the error-handling middleware can catch and return them.",
      keywords: ['try', 'catch', 'promise', 'next', 'error', 'middleware', 'reject']
    },
    {
      question: "What is the purpose of package-lock.json, and why is it important in a team environment?",
      idealAnswer: "package-lock.json locks the exact version of every package and sub-dependency installed in the node_modules folder. This guarantees that all developers and build servers in a team environment install the exact same dependency tree, preventing 'works on my machine' version incompatibility issues.",
      keywords: ['version', 'dependency', 'lock', 'lockfile', 'install', 'team', 'deterministic']
    },
    {
      question: "What is the purpose of npm and package.json, and what is the difference between dependencies and devDependencies?",
      idealAnswer: "npm is Node's package manager. package.json holds project metadata and dependencies. dependencies are required for the application to run in production. devDependencies are only required for development and testing (e.g., linters, compilers, test runners).",
      keywords: ['npm', 'package', 'dependency', 'dev', 'production', 'metadata', 'install']
    },
    {
      question: "What is backpressure in Node.js streams, and how is it handled?",
      idealAnswer: "Backpressure occurs when a readable stream produces data faster than the writable stream can consume it. This causes data buffering in memory. Node handles this automatically when using the `.pipe()` method, pausing the reader until the writer clears its buffer.",
      keywords: ['backpressure', 'stream', 'pipe', 'buffer', 'read', 'write', 'pause', 'resume']
    },
    {
      question: "How does the cluster module in Node.js help in scaling applications?",
      idealAnswer: "The cluster module allows scaling Node applications horizontally across multiple CPU cores. Since Node runs on a single thread, clustering launches a master process that forks worker processes, all sharing the same server port and balancing load among workers.",
      keywords: ['cluster', 'scale', 'fork', 'worker', 'cpu', 'thread', 'load', 'balance']
    },
    {
      question: "What is the Event Emitter class in Node.js, and how do you use it?",
      idealAnswer: "EventEmitter is a core class that facilitates communication between objects in Node. It allows objects to emit named events that cause registered listener functions to run. You use it by importing `events`, extending the class, and calling `emit()` and `on()`.",
      keywords: ['emitter', 'event', 'listener', 'emit', 'on', 'register', 'subscribe']
    },
    {
      question: "What is the difference between require() and import (ES modules) in Node.js?",
      idealAnswer: "require() is CommonJS (synchronous loading, dynamic imports allowed anywhere, returns module.exports). import is ES Modules (asynchronous loading, static analysis, parsed before execution, requires file extensions or package.json type config).",
      keywords: ['require', 'import', 'commonjs', 'esm', 'module', 'static', 'dynamic']
    }
  ],
  'python': [
    {
      question: "What is the difference between lists and tuples in Python, and when would you use each?",
      idealAnswer: "Lists are mutable (can be edited after creation, written with square brackets `[]`), whereas tuples are immutable (cannot be altered, written with parentheses `()`). Lists are used for dynamic collections of identical types. Tuples are used for fixed sequences of data, records, dictionary keys, and are faster and memory-efficient.",
      keywords: ['mutable', 'immutable', 'list', 'tuple', 'bracket', 'parenthes']
    },
    {
      question: "How does memory management work in Python, specifically regarding garbage collection?",
      idealAnswer: "Python manages memory automatically using reference counting and a cyclic garbage collector. Every object has a count of references pointing to it. When an object's reference count drops to zero, Python immediately deallocates it. The cyclic garbage collector runs periodically to detect and delete groups of objects with circular references.",
      keywords: ['garbage', 'reference', 'count', 'cycle', 'collector', 'alloc']
    },
    {
      question: "Can you explain decorators in Python and write a simple example of one?",
      idealAnswer: "A decorator is a design pattern in Python that wraps another function to extend or modify its behavior without permanently altering the code. It is written using the '@decorator_name' syntax. Example: \n```python\ndef my_decorator(func):\n    def wrapper():\n        print('Before call')\n        func()\n        print('After call')\n    return wrapper\n```",
      keywords: ['decorator', 'wrap', 'function', 'arg', 'modify', 'behavi']
    },
    {
      question: "What are generators and yield statements in Python, and how do they save memory?",
      idealAnswer: "Generators are functions that return an iterator using the 'yield' statement instead of 'return'. Instead of computing all values at once and storing them in memory, yield pauses function execution and returns one value at a time on demand. This enables lazy evaluation, saving significant memory for massive or infinite sequences.",
      keywords: ['yield', 'generator', 'iterator', 'memory', 'lazy', 'next']
    },
    {
      question: "What is the difference between deep copy and shallow copy in Python?",
      idealAnswer: "A shallow copy constructs a new compound object and inserts references to the original nested objects, meaning modifications to inner lists affect both copies. A deep copy recursively copies the original object and all nested objects, creating completely independent data structures with no shared references.",
      keywords: ['reference', 'copy', 'nested', 'object', 'recursive', 'clone']
    },
    {
      question: "What is PEP 8, and why is it important in the Python community?",
      idealAnswer: "PEP 8 is the official style guide for writing Python code. It defines conventions for indentation, naming, line length, and spacing, ensuring consistency, code readability, and easy collaboration across the Python community.",
      keywords: ['pep8', 'style', 'guide', 'read', 'consistent', 'name', 'format']
    },
    {
      question: "What are list comprehensions in Python, and how do they differ from map/filter?",
      idealAnswer: "List comprehensions offer a concise syntax to create lists based on existing lists. E.g. `[x*2 for x in nums if x > 2]`. They combine map and filter operations, are often faster, and are considered more readable and 'Pythonic' than map/filter.",
      keywords: ['comprehension', 'list', 'map', 'filter', 'pythonic', 'syntax', 'bracket']
    },
    {
      question: "How do you handle exceptions in Python, and what is the purpose of the 'finally' block?",
      idealAnswer: "Exceptions are handled using a try-except block. The 'try' block contains code that might raise an error. The 'except' block catches it. The 'finally' block executes cleanup code *always*, regardless of whether an exception was raised or caught.",
      keywords: ['try', 'except', 'exception', 'finally', 'error', 'raise', 'cleanup']
    },
    {
      question: "What is the difference between *args and **kwargs in Python function definitions?",
      idealAnswer: "*args allows a function to accept any number of positional arguments (collected into a tuple). **kwargs allows a function to accept any number of keyword/named arguments (collected into a dictionary).",
      keywords: ['args', 'kwargs', 'positional', 'keyword', 'tuple', 'dictionary', 'argument']
    },
    {
      question: "What is the GIL (Global Interpreter Lock) in Python, and how does it affect multi-threading?",
      idealAnswer: "The GIL is a mutex in CPython that prevents multiple native threads from executing Python bytecodes at once. This makes multi-threading in Python unable to utilize multiple CPU cores for CPU-bound tasks, requiring multi-processing instead.",
      keywords: ['gil', 'lock', 'thread', 'multi-threading', 'cpu', 'core', 'mutex', 'interpreter']
    }
  ],
  'general': [
    {
      question: "What is your understanding of RESTful API design principles, and how do you structure your endpoints?",
      idealAnswer: "RESTful principles model resources as nouns (e.g. /users) and use HTTP verbs for actions (GET to retrieve, POST to create, PUT/PATCH to edit, DELETE to delete). REST APIs are stateless, separating client and server concerns, and return standard status codes (e.g., 200 OK, 201 Created, 404 Not Found, 500 Server Error) and standard payloads.",
      keywords: ['stateless', 'verb', 'get', 'post', 'put', 'delete', 'endpoint', 'resource']
    },
    {
      question: "Could you explain the difference between SQL and NoSQL databases, and when to choose which?",
      idealAnswer: "SQL databases are relational, use tables/schemas, support complex JOINs, and enforce ACID properties (ideal for structured transactions, finance). NoSQL databases are non-relational (document, key-value, graph), have dynamic schemas, scale horizontally, and are ideal for unstructured big data, real-time analytics, and rapid development.",
      keywords: ['schema', 'relational', 'table', 'document', 'join', 'scale', 'nosql']
    },
    {
      question: "What is Git branching strategy, and how do you handle merge conflicts in a team?",
      idealAnswer: "Branching strategies (like GitFlow, GitHub Flow) organize development using feature branches merged into a main or develop branch via Pull Requests. To resolve merge conflicts: pull the latest target branch locally, merge it into your feature branch, resolve conflicting lines manually in code, stage, commit, and push the resolved code.",
      keywords: ['merge', 'conflict', 'branch', 'rebase', 'git', 'pr', 'pull', 'commit']
    },
    {
      question: "How do you approach writing clean, testable code, and what is your view on Unit Testing?",
      idealAnswer: "Clean code adheres to SOLID principles, DRY (Don't Repeat Yourself), and utilizes small, single-responsibility functions. Testable code avoids tight coupling and global state. Unit testing verifies isolated blocks (functions or classes) in mock environments, ensuring long-term code stability and fast bug detection during refactoring.",
      keywords: ['test', 'clean', 'read', 'dry', 'solid', 'isolated', 'mock']
    },
    {
      question: "Can you describe a challenging technical problem you solved recently and your approach?",
      idealAnswer: "Candidates should describe a complex technical issue (like performance bottlenecks, race conditions, memory leaks) and their analytical troubleshooting steps: isolating the bug using profiling/logging tools, researching options, applying a clean fix, and writing automated tests to prevent regression.",
      keywords: ['solved', 'debug', 'error', 'challenge', 'approach', 'fix']
    },
    {
      question: "What is the difference between HTTP and HTTPS, and how does HTTPS encrypt communications?",
      idealAnswer: "HTTP sends data in plain text, making it vulnerable to interception. HTTPS encrypts data using SSL/TLS protocols. It uses asymmetric encryption (public/private keys) to establish a secure session key, and symmetric encryption for actual data transfer.",
      keywords: ['http', 'https', 'encrypt', 'ssl', 'tls', 'secure', 'certificate', 'private']
    },
    {
      question: "What is the difference between authentication and authorization in system security?",
      idealAnswer: "Authentication verifies *who* the user is (e.g. login credentials, MFA, biometric checks). Authorization determines *what* permissions the authenticated user has (e.g. read access, admin roles, API rate limits).",
      keywords: ['authentication', 'authorization', 'permission', 'identity', 'role', 'login']
    },
    {
      question: "What are the core concepts of Object-Oriented Programming (OOP)?",
      idealAnswer: "The four pillars of OOP are: 1) Encapsulation (hiding internal state/details), 2) Inheritance (sharing properties/methods between classes), 3) Polymorphism (overriding methods in subclasses), and 4) Abstraction (hiding complexity behind interfaces).",
      keywords: ['pillar', 'oop', 'encapsulation', 'inheritance', 'polymorphism', 'abstraction']
    },
    {
      question: "What a RESTful API vs GraphQL, and when would you use GraphQL?",
      idealAnswer: "RESTful APIs expose resources via separate endpoints (GET /users, GET /posts), which can lead to over-fetching. GraphQL uses a single endpoint where clients request exactly the fields they need in a query schema, making it ideal for mobile apps or complex nested data.",
      keywords: ['rest', 'graphql', 'endpoint', 'query', 'schema', 'over-fetching', 'field']
    },
    {
      question: "What is the purpose of Docker and containerization in modern deployment?",
      idealAnswer: "Docker packages an application and all its dependencies, system libraries, and configs into a lightweight container. This ensures that the application runs identically in any environment (local, testing, cloud), eliminating configuration differences.",
      keywords: ['docker', 'container', 'environment', 'dependency', 'deploy', 'isolated', 'package']
    }
  ]
};

// Helper: Get matching mock questions based on topic search
function getMockQuestionsForTopic(topic = '') {
  const cleanTopic = topic.toLowerCase().trim();
  if (cleanTopic.includes('react')) return MOCK_DATA.react;
  if (cleanTopic.includes('node')) return MOCK_DATA.node;
  if (cleanTopic.includes('javascript') || cleanTopic.includes('js')) return MOCK_DATA.javascript;
  if (cleanTopic.includes('python')) return MOCK_DATA.python;
  return MOCK_DATA.general;
}

// Helper: Check if two questions are similar (prevents duplicate questions)
function isSimilarQuestion(q1, q2) {
  if (!q1 || !q2) return false;
  
  // Strip common recruiter greetings/preambles so we only compare the actual question
  const cleanQ = (q) => {
    return q
      .replace(/Hello\s+[A-Za-z0-9\s]+,\s*thank\s+you\s+for\s+joining\s+today's\s+session\..*Let's\s+start\s+with\s+our\s+first\s+question\./gi, '')
      .replace(/Hello\s+[A-Za-z0-9\s]+,\s*let's\s+start\..*first\s+question:/gi, '')
      .replace(/Let's\s+start\s+with\s+our\s+first\s+question\./gi, '')
      .replace(/Here\s+is\s+your\s+first\s+question:/gi, '')
      .replace(/First\s+question:/gi, '')
      .replace(/Next\s+question:/gi, '')
      .replace(/Question\s+\d+:/gi, '')
      .trim();
  };

  const clean1 = cleanQ(q1).toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const clean2 = cleanQ(q2).toLowerCase().replace(/[^a-z0-9\s]/g, '');

  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    return true;
  }

  // Word overlap
  const words1 = clean1.split(/\s+/).filter(w => w.length > 3);
  const words2 = clean2.split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return false;

  const set2 = new Set(words2);
  let overlap = 0;
  words1.forEach(w => {
    if (set2.has(w)) overlap++;
  });

  const similarity = overlap / Math.min(words1.length, words2.length);
  return similarity > 0.65; // 65% overlap of significant words
}

// Helper: Get a random question in the category that is not similar to anything in history
function getNonDuplicateQuestion(category, historyList) {
  const questions = MOCK_DATA[category] || MOCK_DATA.general;
  const askedQuestions = (historyList || []).map(h => h.question);
  
  // Filter questions that are not similar to any asked question
  const remaining = questions.filter(q => {
    return !askedQuestions.some(asked => isSimilarQuestion(q.question, asked));
  });
  
  if (remaining.length > 0) {
    return remaining[Math.floor(Math.random() * remaining.length)];
  }
  
  // If all are asked, fallback to general category
  const generalQuestions = MOCK_DATA.general;
  const remainingGeneral = generalQuestions.filter(q => {
    return !askedQuestions.some(asked => isSimilarQuestion(q.question, asked));
  });
  if (remainingGeneral.length > 0) {
    return remainingGeneral[Math.floor(Math.random() * remainingGeneral.length)];
  }
  
  // Absolute fallback: pick any question
  return questions[Math.floor(Math.random() * questions.length)];
}


const MOCK_CODING_QUESTIONS = {
  'javascript': [
    {
      title: "Reverse a String",
      description: "Write a function `reverseString(str)` that takes a string as input and returns it reversed. For example, `reverseString('hello')` should return `'olleh'`.",
      template: "function reverseString(str) {\n  // Write your code here\n  \n}",
      functionName: "reverseString",
      testCases: [
        { input: "'hello'", expectedOutput: "'olleh'" },
        { input: "'React'", expectedOutput: "'tcaeR'" },
        { input: "'a'", expectedOutput: "'a'" }
      ]
    },
    {
      title: "Find Maximum Element",
      description: "Write a function `findMax(arr)` that takes an array of numbers and returns the largest number. For example, `findMax([1, 5, 3, 9, 2])` should return `9`.",
      template: "function findMax(arr) {\n  // Write your code here\n  \n}",
      functionName: "findMax",
      testCases: [
        { input: "[1, 5, 3, 9, 2]", expectedOutput: "9" },
        { input: "[-10, -5, -20]", expectedOutput: "-5" },
        { input: "[42]", expectedOutput: "42" }
      ]
    }
  ],
  'react': [
    {
      title: "Virtual DOM HTML Renderer",
      description: "Write a function `renderVirtualDOM(vnode)` that takes a virtual DOM node object and converts it to an HTML string. A vnode has the structure: `{ type: 'div', props: { id: 'app', className: 'box' }, children: ['Hello'] }`. For `className`, render it as `class` attribute in the HTML. For example, `renderVirtualDOM({ type: 'span', props: { className: 'text' }, children: ['React'] })` should return `'<span class=\"text\">React</span>'`. If children contain text, render the text directly; if children contain another node, recursively render it.",
      template: "function renderVirtualDOM(vnode) {\n  // Write your code here\n  \n}",
      functionName: "renderVirtualDOM",
      testCases: [
        { input: "{ type: 'span', props: { className: 'text' }, children: ['React'] }", expectedOutput: "'<span class=\"text\">React</span>'" },
        { input: "{ type: 'div', props: { id: 'app' }, children: [] }", expectedOutput: "'<div id=\"app\"></div>'" },
        { input: "'Plain Text'", expectedOutput: "'Plain Text'" }
      ]
    },
    {
      title: "React classNames Builder",
      description: "Write a function `classNames(...args)` that joins class names dynamically. It should accept strings, arrays of strings, and objects where keys are class names and values are boolean expressions. For example, `classNames('btn', { 'btn-active': true, 'btn-disabled': false }, ['btn-large'])` should return `'btn btn-active btn-large'`.",
      template: "function classNames(...args) {\n  // Write your code here\n  \n}",
      functionName: "classNames",
      testCases: [
        { input: "'btn', { 'btn-active': true, 'btn-disabled': false }, ['btn-large']", expectedOutput: "'btn btn-active btn-large'" },
        { input: "'header', null, undefined, { 'show': true }", expectedOutput: "'header show'" },
        { input: "['a', ['b', { 'c': true }]]", expectedOutput: "'a b c'" }
      ]
    }
  ],
  'node': [
    {
      title: "Format Query String",
      description: "Write a function `parseQueryParams(url)` that extracts query parameters from a URL and returns them as a key-value object. For example, `parseQueryParams('https://example.com?page=2&limit=10')` should return `{\"page\":\"2\",\"limit\":\"10\"}`.",
      template: "function parseQueryParams(url) {\n  // Write your code here\n  \n}",
      functionName: "parseQueryParams",
      testCases: [
        { input: "'https://example.com?name=john&age=30'", expectedOutput: '{"name":"john","age":"30"}' },
        { input: "'https://test.io?search=react'", expectedOutput: '{"search":"react"}' },
        { input: "'https://api.com'", expectedOutput: '{}' }
      ]
    },
    {
      title: "Sum Digits of Number",
      description: "Write a function `sumDigits(n)` that takes a positive integer and returns the sum of its digits. For example, `sumDigits(123)` should return `6`.",
      template: "function sumDigits(n) {\n  // Write your code here\n  \n}",
      functionName: "sumDigits",
      testCases: [
        { input: "123", expectedOutput: "6" },
        { input: "909", expectedOutput: "18" },
        { input: "5", expectedOutput: "5" }
      ]
    }
  ],
  'python': [
    {
      title: "Palindrome Check",
      description: "Write a Python function `is_palindrome(s)` that checks if a given string is a palindrome (reads the same backward as forward, ignoring case). For example, `is_palindrome('racecar')` should return `True`.",
      template: "def is_palindrome(s):\n    # Write your code here\n    pass",
      functionName: "is_palindrome",
      testCases: [
        { input: "'racecar'", expectedOutput: "True" },
        { input: "'hello'", expectedOutput: "False" },
        { input: "'Madam'", expectedOutput: "True" }
      ]
    },
    {
      title: "Find Even Numbers",
      description: "Write a Python function `get_evens(nums)` that takes a list of integers and returns a list containing only the even numbers. For example, `get_evens([1, 2, 3, 4])` should return `[2, 4]`.",
      template: "def get_evens(nums):\n    # Write your code here\n    pass",
      functionName: "get_evens",
      testCases: [
        { input: "[1, 2, 3, 4]", expectedOutput: "[2, 4]" },
        { input: "[1, 3, 5]", expectedOutput: "[]" },
        { input: "[0, -2, -3]", expectedOutput: "[0, -2]" }
      ]
    }
  ],
  'general': [
    {
      title: "Two Sum Indices",
      description: "Write a function `twoSum(nums, target)` that finds two numbers in the array `nums` that add up to `target`, and returns their indices as an array. For example, `twoSum([2, 7, 11, 15], 9)` should return `[0, 1]`.",
      template: "function twoSum(nums, target) {\n  // Write your code here\n  \n}",
      functionName: "twoSum",
      testCases: [
        { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
        { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" },
        { input: "[3, 3], 6", expectedOutput: "[0, 1]" }
      ]
    },
    {
      title: "Fibonacci Number",
      description: "Write a function `fibonacci(n)` that returns the nth Fibonacci number (where F(0) = 0, F(1) = 1, F(2) = 1, F(3) = 2, etc.). For example, `fibonacci(6)` should return `8`.",
      template: "function fibonacci(n) {\n  // Write your code here\n  \n}",
      functionName: "fibonacci",
      testCases: [
        { input: "6", expectedOutput: "8" },
        { input: "0", expectedOutput: "0" },
        { input: "1", expectedOutput: "1" }
      ]
    }
  ]
};

function getMockCodingQuestionForTopic(topic = '') {
  const cleanTopic = topic.toLowerCase().trim();
  
  // React is not supported as a runnable live coding environment. Skip!
  if (cleanTopic.includes('react')) {
    return null;
  }
  
  const hasJS = cleanTopic.includes('javascript') || cleanTopic.includes('js') || cleanTopic.includes('node');
  const hasPython = cleanTopic.includes('python');
  
  if (!hasJS && !hasPython) {
    return null;
  }

  let list = MOCK_CODING_QUESTIONS.general;
  if (cleanTopic.includes('node')) list = MOCK_CODING_QUESTIONS.node;
  else if (cleanTopic.includes('javascript') || cleanTopic.includes('js')) list = MOCK_CODING_QUESTIONS.javascript;
  else if (cleanTopic.includes('python')) list = MOCK_CODING_QUESTIONS.python;
  
  // Pick a random question from list
  return list[Math.floor(Math.random() * list.length)];
}

// Helper: Call Groq API using native fetch (OpenAI-compatible) with fallback models and keys support
async function callGroq(prompt, clientApiKey = null, systemPrompt = null) {
  const primaryKey = clientApiKey || process.env.GROQ_API_KEY;
  const secondaryKey = process.env.SECONDARY_GROQ_API_KEY;

  const keysToTry = [];
  if (primaryKey) {
    keysToTry.push({ key: primaryKey, label: "primary" });
  }
  if (secondaryKey && secondaryKey !== primaryKey) {
    keysToTry.push({ key: secondaryKey, label: "secondary fallback" });
  }

  if (keysToTry.length === 0) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Define fallback hierarchy
  const primaryModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const fallbackModels = [
    primaryModel,
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "llama3-8b-8192",
    "llama3-70b-8192"
  ];
  // Deduplicate and maintain order
  const modelsToTry = Array.from(new Set(fallbackModels));

  let lastError = null;

  for (const keyObj of keysToTry) {
    const activeKey = keyObj.key;
    console.log(`[Groq API] Attempting call using ${keyObj.label} API Key`);

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      console.log(`[Groq API] Attempting call with model: "${currentModel}" (Attempt ${i + 1}/${modelsToTry.length})`);
      
      const requestBody = {
        model: currentModel,
        messages,
        response_format: {
          type: "json_object"
        },
        temperature: 0.7
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${activeKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) {
          throw new Error("Received empty message content response");
        }

        const parsedJSON = JSON.parse(responseText.trim());
        console.log(`[Groq API] Success using ${keyObj.label} API Key and model "${currentModel}"`);
        return parsedJSON;
      } catch (error) {
        console.warn(`[Groq API] Warning: ${keyObj.label} API Key with model "${currentModel}" failed. Error: ${error.message}`);
        lastError = error;

        // If it's a authorization error or invalid key, skip remaining models for this key
        if (error.message.includes("Status 401") || error.message.includes("Status 403")) {
          console.warn(`[Groq API] Auth/Access error. Skipping remaining models for this key.`);
          break;
        }
      }
    }
  }

  console.error("[Groq API] Error: All candidate models and keys failed.");
  throw lastError || new Error("All Groq model attempts failed.");
}

// Helper: Generate fallback starting questions list and coding challenges
function generateFallbackStart(name, topic, difficulty, numQuestions, resumeText) {
  const hasResume = !!resumeText;
  const targetNum = hasResume ? 8 : (parseInt(numQuestions) || 5);
  
  let questionsList = [];
  let codingQuestions = [];

  if (hasResume) {
    // Find skills in resume text
    const cleanResume = resumeText.toLowerCase();
    const detectedTopics = [];
    if (cleanResume.includes('react')) detectedTopics.push('react');
    if (cleanResume.includes('node')) detectedTopics.push('node');
    if (cleanResume.includes('python')) detectedTopics.push('python');
    if (cleanResume.includes('javascript') || cleanResume.includes('js')) detectedTopics.push('javascript');

    if (detectedTopics.length === 0) {
      detectedTopics.push('general');
    }

    // Collect mock questions
    let pooledQuestions = [];
    detectedTopics.forEach(t => {
      pooledQuestions = pooledQuestions.concat(MOCK_DATA[t] || []);
    });
    // Fill with general if not enough
    if (pooledQuestions.length < 8) {
      pooledQuestions = pooledQuestions.concat(MOCK_DATA.general || []);
    }

    // Select 8 unique questions
    const selectedQuestions = [];
    const usedIndices = new Set();
    while (selectedQuestions.length < 8 && usedIndices.size < pooledQuestions.length) {
      const randIdx = Math.floor(Math.random() * pooledQuestions.length);
      if (!usedIndices.has(randIdx)) {
        usedIndices.add(randIdx);
        selectedQuestions.push(pooledQuestions[randIdx]);
      }
    }
    questionsList = selectedQuestions;

    // Select 3 coding questions with different languages if present
    const hasPython = cleanResume.includes('python');
    const hasJS = cleanResume.includes('javascript') || cleanResume.includes('js');

    if (!hasPython && !hasJS) {
      codingQuestions = [];
    } else {
      let pythonList = MOCK_CODING_QUESTIONS.python || [];
      let jsList = (MOCK_CODING_QUESTIONS.javascript || []).concat(MOCK_CODING_QUESTIONS.react || []).concat(MOCK_CODING_QUESTIONS.node || []);

      if (hasPython && hasJS) {
        // Pick 1 Python, 2 JS
        const pQ = pythonList[Math.floor(Math.random() * pythonList.length)];
        const jQ1 = jsList[Math.floor(Math.random() * jsList.length)];
        let jQ2 = jsList[Math.floor(Math.random() * jsList.length)];
        while (jQ2 === jQ1 && jsList.length > 1) {
          jQ2 = jsList[Math.floor(Math.random() * jsList.length)];
        }
        
        codingQuestions.push({ ...pQ, language: 'python' });
        codingQuestions.push({ ...jQ1, language: 'javascript' });
        codingQuestions.push({ ...jQ2, language: 'javascript' });
      } else if (hasPython) {
        // Pick 3 Python (fallback to general/duplicates)
        const pQ1 = pythonList[Math.floor(Math.random() * pythonList.length)];
        let pQ2 = pythonList[Math.floor(Math.random() * pythonList.length)];
        if (pythonList.length > 1 && pQ2 === pQ1) {
          pQ2 = pythonList.find(q => q !== pQ1);
        }
        const genList = MOCK_CODING_QUESTIONS.general || [];
        const gQ = genList[Math.floor(Math.random() * genList.length)];
        
        codingQuestions.push({ ...pQ1, language: 'python' });
        codingQuestions.push({ ...pQ2, language: 'python' });
        codingQuestions.push({ ...gQ, language: 'javascript' });
      } else {
        // Pick 3 JS
        const jQ1 = jsList[Math.floor(jsList.length > 0 ? Math.random() * jsList.length : 0)];
        let jQ2 = jsList[Math.floor(jsList.length > 0 ? Math.random() * jsList.length : 0)];
        while (jQ2 === jQ1 && jsList.length > 1) {
          jQ2 = jsList[Math.floor(Math.random() * jsList.length)];
        }
        const genList = MOCK_CODING_QUESTIONS.general || [];
        const gQ = genList[Math.floor(Math.random() * genList.length)];

        if (jQ1) codingQuestions.push({ ...jQ1, language: 'javascript' });
        if (jQ2) codingQuestions.push({ ...jQ2, language: 'javascript' });
        if (gQ) codingQuestions.push({ ...gQ, language: 'javascript' });
      }
    }
  } else {
    const questions = getMockQuestionsForTopic(topic);
    // Pick targetNum random questions
    const selected = [];
    const indices = new Set();
    while (selected.length < targetNum && indices.size < questions.length) {
      const randIdx = Math.floor(Math.random() * questions.length);
      if (!indices.has(randIdx)) {
        indices.add(randIdx);
        selected.push(questions[randIdx]);
      }
    }
    questionsList = selected;

    const singleCoding = getMockCodingQuestionForTopic(topic);
    codingQuestions = singleCoding ? [singleCoding] : [];
  }

  return {
    questionsList,
    codingQuestions
  };
}

// Endpoint 1: Start Interview
app.post('/api/start-interview', async (req, res) => {
  const { name, topic, difficulty, numQuestions, groqApiKey, resumeText } = req.body || {};
  const nameVal = name || 'Candidate';
  const topicVal = topic || 'React Developer';
  const difficultyVal = difficulty || 'Mid-Level';
  const hasResume = !!resumeText;
  const targetNum = hasResume ? 8 : (parseInt(numQuestions) || 5);
  const activeKey = groqApiKey || process.env.GROQ_API_KEY || SECONDARY_GROQ_API_KEY;

  console.log(`Starting interview for ${nameVal} on topic "${topicVal}" (${difficultyVal}, ${targetNum} questions, resume customization: ${hasResume})`);

  // Detect coding feasibility
  const cleanResume = (resumeText || '').toLowerCase();
  const hasResumePython = cleanResume.includes('python');
  const hasResumeJS = cleanResume.includes('javascript') || cleanResume.includes('js');
  
  const cleanTopic = topicVal.toLowerCase().trim();
  const hasTopicJS = cleanTopic.includes('javascript') || cleanTopic.includes('js') || cleanTopic.includes('node');
  const hasTopicPython = cleanTopic.includes('python');

  const isCodingPossible = hasResume ? (hasResumePython || hasResumeJS) : ((hasTopicJS || hasTopicPython) && !cleanTopic.includes('react'));

  if (!activeKey) {
    // FALLBACK MODE
    const fallbackData = generateFallbackStart(nameVal, topicVal, difficultyVal, targetNum, resumeText);
    const chosen = fallbackData.questionsList[0];
    const welcome = `Hello ${nameVal}, thank you for joining today's session. I've parsed your details. I'll be taking your interview for the ${difficultyVal} ${topicVal} role. Let's start with our first question.`;
    return res.json({
      question: welcome + " " + chosen.question,
      emotion: 'smiling',
      isMock: true,
      currentQuestionIndex: 0,
      totalQuestions: targetNum,
      codingQuestions: isCodingPossible ? fallbackData.codingQuestions : [],
      codingQuestion: isCodingPossible ? fallbackData.codingQuestions[0] : null
    });
  }

  // GROQ MODE
  if (hasResume) {
    const systemPrompt = `You are a professional senior technical recruiter taking a mock interview.
You must return your response in a clean JSON object containing "question", "emotion", and "codingQuestions" keys.
"emotion" should be one of: "smiling", "friendly", "curious", "professional".
"codingQuestions" must be an array of coding challenges.
If neither JavaScript (JS) nor Python is present/mentioned in the resume, "codingQuestions" MUST be an empty array [].
If coding challenges are generated, each coding challenge must contain:
- "title": A short title of the programming challenge.
- "description": A clear description of the programming challenge. The problem must be solvable in standard, plain language (JavaScript or Python).
- "template": Starter code template including function signature.
- "functionName": The exact name of the function to be invoked.
- "language": Either "javascript" or "python" (ensure you only generate challenges in languages mentioned in the resume).
- "testCases": An array of exactly 3 test cases. Each test case must be a JSON object containing "input" (parameters comma-separated, e.g. "[2, 7], 9" or "'hello'" or "1, 2") and "expectedOutput" (string representation of expected output, e.g. "9" or "'olleh'" or "True"/"False" for Python).`;

    const prompt = `Candidate Name: ${nameVal}
Target Difficulty: ${difficultyVal}
Resume Text:
"""
${resumeText}
"""

This is the very beginning of the interview.
Tasks:
1. Parse the resume to identify the candidate's core technologies and languages (e.g. JavaScript, Python, C++, etc.).
2. You will ask a total of 8 theory questions in this interview. Welcome the candidate and present the FIRST technical question (1-2 sentences) checking a key skill from their resume.
3. Generate EXACTLY 3 coding challenges in different languages (specifically JavaScript and Python if both are mentioned/present in the resume) based on the resume skills. If neither is present, set codingQuestions to [].
4. Respond ONLY in this JSON format:
{
  "question": "Your greeting and first theory question.",
  "emotion": "smiling",
  "codingQuestions": [
    {
      "title": "Title 1",
      "description": "...",
      "template": "...",
      "functionName": "...",
      "language": "javascript",
      "testCases": [...]
    },
    ...
  ]
}`;

    try {
      const aiResponse = await callGroq(prompt, activeKey, systemPrompt);
      let questionText = aiResponse.question || '';
      const lowerQ = questionText.toLowerCase().trim();
      if (!lowerQ.startsWith('hello') && !lowerQ.startsWith('hi') && !lowerQ.startsWith('welcome')) {
        questionText = `Hello ${nameVal}, thank you for joining today's session. I'll be taking your interview for the ${difficultyVal} ${topicVal} role. Let's start with our first question: ${questionText}`;
      }
      res.json({
        question: questionText,
        emotion: aiResponse.emotion || 'smiling',
        isMock: false,
        currentQuestionIndex: 0,
        totalQuestions: 8,
        codingQuestions: isCodingPossible ? (aiResponse.codingQuestions || []) : [],
        codingQuestion: isCodingPossible && aiResponse.codingQuestions && aiResponse.codingQuestions.length > 0 ? aiResponse.codingQuestions[0] : null
      });
    } catch (error) {
      console.warn("Groq resume start failed, falling back to mock engine:", error);
      const fallbackData = generateFallbackStart(nameVal, topicVal, difficultyVal, targetNum, resumeText);
      const chosen = fallbackData.questionsList[0];
      res.json({
        question: `Hello ${nameVal}, let's start. Here is your first question: ${chosen.question}`,
        emotion: 'smiling',
        isMock: true,
        currentQuestionIndex: 0,
        totalQuestions: 8,
        codingQuestions: isCodingPossible ? fallbackData.codingQuestions : [],
        codingQuestion: isCodingPossible ? fallbackData.codingQuestions[0] : null
      });
    }
    return;
  }

  // STANDARD GROQ MODE (NO RESUME)
  const isPython = topicVal.toLowerCase().includes('python');
  const codingLanguage = isPython ? 'Python' : 'JavaScript';
  const functionTemplateExample = isPython ? 'def name(...):\n    pass' : 'function name(...) {\n  // ...\n}';
  const expectedOutputExample = isPython ? '"True"' : '"[0,1]"';

  const systemPrompt = `You are a professional senior technical recruiter taking a mock interview.
You must return your response in a clean JSON object containing "question", "emotion", and "codingQuestion" keys.
"emotion" should be one of: "smiling", "friendly", "curious", "professional".
"codingQuestion" must be a JSON object containing:
- "title": A short title of the programming challenge.
- "description": A clear description of the programming challenge. The problem must be solvable in standard, plain ${codingLanguage} (without JSX or third-party web frameworks, as it will run directly in a headless browser/Pyodide sandbox).
- "template": Starter code template including function signature.
- "functionName": The exact name of the function to be invoked.
- "testCases": An array of exactly 3 test cases. Each test case must be a JSON object containing "input" (parameters comma-separated, e.g. "[2, 7], 9" or "'hello'" or "1, 2") and "expectedOutput" (string representation of expected output, e.g. ${expectedOutputExample} or ${isPython ? '"False"' : '"olleh"'});`;

  const randomSeed = Math.random().toString(36).substring(7);
  const prompt = `Candidate Name: ${name}
Role/Topic: ${difficulty} level expertise in "${topic}"
Total Questions to ask: ${targetNum}
Session ID / Random Seed: ${randomSeed}

This is the very beginning of the interview. You need to greet the candidate and ask the FIRST question.
Welcome the candidate briefly (1 sentence) and present the first technical question (1-2 sentences).
To prevent repetitive mock questions, you MUST generate a completely unique, specific technical question for the topic. Avoid generic standard questions unless they contain a unique twist.
Additionally, you must generate a ${codingLanguage} coding challenge suitable for a ${difficulty} level candidate on the topic of "${topic}".
Respond ONLY in this JSON format:
{
  "question": "Your greeting and the first theory question.",
  "emotion": "smiling",
  "codingQuestion": {
    "title": "Title",
    "description": "Description...",
    "template": "${functionTemplateExample}",
    "functionName": "name",
    "testCases": [
      { "input": "...", "expectedOutput": "..." }
    ]
  }
}`;

  try {
    const aiResponse = await callGroq(prompt, activeKey, systemPrompt);
    let questionText = aiResponse.question || '';
    const lowerQ = questionText.toLowerCase().trim();
    if (!lowerQ.startsWith('hello') && !lowerQ.startsWith('hi') && !lowerQ.startsWith('welcome')) {
      questionText = `Hello ${nameVal}, thank you for joining today's session. I'll be taking your interview for the ${difficultyVal} ${topicVal} role. Let's start with our first question: ${questionText}`;
    }
    res.json({
      question: questionText,
      emotion: aiResponse.emotion || 'smiling',
      isMock: false,
      currentQuestionIndex: 0,
      totalQuestions: targetNum,
      codingQuestion: isCodingPossible ? aiResponse.codingQuestion : null
    });
  } catch (error) {
    console.warn("Groq call failed on start-interview, falling back to mock engine.");
    const fallbackData = generateFallbackStart(name, topic, difficulty, numQuestions, resumeText);
    const chosen = fallbackData.questionsList[0];
    res.json({
      question: `Hello ${name}, let's start. Here is your first question: ${chosen.question}`,
      emotion: 'smiling',
      isMock: true,
      currentQuestionIndex: 0,
      totalQuestions: targetNum,
      codingQuestion: isCodingPossible ? fallbackData.codingQuestions[0] : null
    });
  }
});

// Endpoint 2: Submit Answer
app.post('/api/submit-answer', async (req, res) => {
  const { name, topic, difficulty, numQuestions, currentQuestionIndex, candidateAnswer, history, groqApiKey } = req.body;
  const nextIndex = parseInt(currentQuestionIndex) + 1;
  const total = parseInt(numQuestions) || 5;
  const activeKey = groqApiKey || process.env.GROQ_API_KEY || SECONDARY_GROQ_API_KEY;

  console.log(`Submitting answer for question ${currentQuestionIndex}/${total - 1} from ${name}`);

  const cleanTopic = topic.toLowerCase().trim();
  const category = cleanTopic.includes('react') ? 'react' :
                   cleanTopic.includes('node') ? 'node' :
                   (cleanTopic.includes('javascript') || cleanTopic.includes('js')) ? 'javascript' :
                   cleanTopic.includes('python') ? 'python' : 'general';

  if (!activeKey) {
    // FALLBACK MODE
    const isComplete = nextIndex >= total;
    let nextQuestion = "Thank you, that is the last question. I will now compile your feedback report.";
    if (!isComplete) {
      const nonDuplicateObj = getNonDuplicateQuestion(category, history);
      nextQuestion = nonDuplicateObj.question;
    }
    
    // Create static mock feedback
    const mockFeedback = candidateAnswer.trim().split(/\s+/).length < 5
      ? "Your response was very brief. It's recommended to provide a more detailed explanation in technical interviews."
      : `Good point regarding this topic. In a real interview, you could expand further with concrete architectural examples.`;

    return res.json({
      feedback: mockFeedback,
      question: nextQuestion,
      emotion: isComplete ? 'friendly' : 'curious',
      isComplete,
      currentQuestionIndex: nextIndex
    });
  }

  // GROQ MODE
  // Format history for context
  const formattedHistory = history.map(h => `Recruiter: "${h.question}"\nCandidate: "${h.answer || '(No response)'}"`).join('\n\n');
  const isFinalQuestion = nextIndex >= total;
  
  const systemPrompt = `You are a professional senior technical recruiter taking a mock interview.
You must return your response in a clean JSON object containing "feedback", "question", "emotion", and "isComplete" keys.
"emotion" should be one of: "smiling", "friendly", "curious", "professional", "thinking".`;

  const randomSeed = Math.random().toString(36).substring(7);
  const prompt = `Candidate: ${name}
Role/Topic: ${difficulty} level expertise in "${topic}"
Total Questions in Interview: ${total}
Current Question Index: ${currentQuestionIndex} (0-indexed)
Session ID / Random Seed: ${randomSeed}

Interview History so far:
${formattedHistory}

The candidate's latest response to your last question is: "${candidateAnswer}"

Perform the following tasks:
1. Provide a very brief, constructive evaluation of the candidate's answer (1-2 sentences max).
2. If this was NOT the final question (nextIndex: ${nextIndex} is less than total: ${total}), generate the next technical interview question. Ensure it is unique, and flows logically from the conversation or covers a new subtopic. Do not ask questions similar to ones already in the history.
3. If this WAS the final question (nextIndex: ${nextIndex} >= total: ${total}), set isComplete to true and output a polite closing remark.

Respond ONLY in this JSON format:
{
  "feedback": "Brief feedback about their answer.",
  "question": "The next question or final closing remark.",
  "emotion": "smiling / curious / professional / thinking",
  "isComplete": ${isFinalQuestion}
}`;

  try {
    const aiResponse = await callGroq(prompt, activeKey, systemPrompt);
    let finalNextQuestion = aiResponse.question;
    
    // Validate that the generated question is not similar to anything in history
    const askedQuestions = history.map(h => h.question);
    if (!isFinalQuestion && askedQuestions.some(asked => isSimilarQuestion(finalNextQuestion, asked))) {
      console.log(`[Server] Groq returned duplicate question: "${finalNextQuestion}". Replacing with non-duplicate fallback.`);
      const fallbackObj = getNonDuplicateQuestion(category, history);
      finalNextQuestion = fallbackObj.question;
    }

    res.json({
      feedback: aiResponse.feedback,
      question: finalNextQuestion,
      emotion: aiResponse.emotion || 'professional',
      isComplete: aiResponse.isComplete || isFinalQuestion,
      currentQuestionIndex: nextIndex
    });
  } catch (error) {
    console.warn("Groq call failed on submit-answer, falling back to mock engine.");
    const isComplete = nextIndex >= total;
    let nextQuestion = "Thank you, that is the last question. I will now compile your feedback report.";
    if (!isComplete) {
      const fallbackObj = getNonDuplicateQuestion(category, history);
      nextQuestion = fallbackObj.question;
    }
    
    res.json({
      feedback: "Good response. In mock mode, feedback is simplified.",
      question: nextQuestion,
      emotion: 'professional',
      isComplete,
      currentQuestionIndex: nextIndex
    });
  }
});

// Endpoint 3: End Interview / Compile Report
app.post('/api/end-interview', async (req, res) => {
  const { name, topic, difficulty, history, codingQuestion, codingQuestionsList, codingScoreDetails, candidateCode, codingTestResults, tabWarningsCount, warningCounts, disqualified, disqualificationReason, groqApiKey, violationScreenshots } = req.body;

  console.log(`Generating final report for ${name} on topic "${topic}" (Disqualified: ${disqualified || false})`);

  // Handle immediate proctoring disqualification
  if (disqualified) {
    const formattedReason = disqualificationReason ? disqualificationReason.charAt(0).toUpperCase() + disqualificationReason.slice(1) : "Proctoring Violation";
    const finalReport = {
      overallScore: 0,
      strengths: ["Session initiated successfully."],
      improvements: [`DISQUALIFIED: The interview was terminated early due to 5 proctoring violations in the "${formattedReason}" category.`],
      breakdown: history.map((item, index) => ({
        question: item.question,
        answer: item.answer || "(No response)",
        idealAnswer: "N/A - Session Terminated due to disqualification.",
        feedback: `Question ${index + 1} was skipped or incomplete due to proctoring termination.`,
        score: 0
      })),
      codingFeedback: `Disqualified. Session was terminated early due to 5 repeated proctoring violations: ${formattedReason}. Under proctoring guidelines, connection of multiple monitors, disabling the camera, tab changes, keyboard cheating shortcuts, or leaving fullscreen mode is strictly forbidden and results in an automatic zero score.`,
      generalTips: [
        "Strictly adhere to proctoring policies.",
        "Ensure a single-screen setup and keep your webcam enabled at all times.",
        "Remain focused inside the active browser viewport throughout the session."
      ],
      isMock: true,
      isDisqualified: true,
      violationScreenshots: violationScreenshots || []
    };
    return res.json(finalReport);
  }

  const activeKey = groqApiKey || process.env.GROQ_API_KEY || SECONDARY_GROQ_API_KEY;

  console.log(`Generating final report for ${name} on topic "${topic}"`);

  if (!activeKey) {
    // FALLBACK MODE - Smart local evaluation
    const questionsList = getMockQuestionsForTopic(topic);
    const breakdown = history.map((item) => {
      const ans = (item.answer || '').trim();
      const lowerAns = ans.toLowerCase();

      // Find original mock question object to retrieve ideal answer and keywords
      const matchedQ = questionsList.find(q => {
        const questionTextClean = q.question.toLowerCase().trim();
        const itemQuestionClean = item.question.replace(/Hello.*first question\.\s*/, '').toLowerCase().trim();
        return itemQuestionClean.includes(questionTextClean) || questionTextClean.includes(itemQuestionClean);
      }) || { question: item.question, idealAnswer: "A model answer is not available for this question.", keywords: [] };

      const keywords = matchedQ.keywords || [];

      // 1. Detect empty, skipped, or evasive responses
      const isNegative = lowerAns === '' || 
                         lowerAns.includes("don't know") || 
                         lowerAns.includes("dont know") || 
                         lowerAns.includes("no idea") || 
                         lowerAns.includes("skip") || 
                         lowerAns.includes("pass") || 
                         lowerAns.includes("can't answer") || 
                         lowerAns.split(/\s+/).length < 3;

      if (isNegative) {
        return {
          question: item.question,
          answer: ans || "(No response)",
          idealAnswer: matchedQ.idealAnswer,
          feedback: "You skipped this question or stated you didn't know the answer. It is critical to share your thought process in technical interviews, even if you are unsure.",
          score: 0
        };
      }

      // 2. Scan answer for matches
      let matchedCount = 0;
      keywords.forEach(kw => {
        if (lowerAns.includes(kw)) matchedCount++;
      });

      const ratio = keywords.length > 0 ? matchedCount / keywords.length : 0.5;

      // 3. Compute realistic score
      let score = 25; // base score for making an attempt
      if (ratio > 0) {
        score += Math.round(ratio * 65); // add up to 65 points
      }
      
      const wordCount = lowerAns.split(/\s+/).length;
      score += Math.min(Math.round(wordCount / 4), 10); // add up to 10 points for elaboration
      score = Math.min(score, 100);

      // Construct detailed, helpful evaluation
      let feedback = "";
      if (score < 45) {
        feedback = `Your answer was very brief and missed key terms like: ${keywords.slice(0, 3).join(', ')}. Expand on technical definitions.`;
      } else if (score < 75) {
        feedback = `Good attempt. You covered the basics, but try to elaborate on ${keywords.slice(2, 5).join(', ')} and provide practical examples.`;
      } else {
        feedback = `Excellent! You successfully demonstrated solid mastery by explaining ${keywords.join(', ')} clearly.`;
      }

      return {
        question: item.question,
        answer: ans,
        idealAnswer: matchedQ.idealAnswer,
        feedback,
        score
      };
    });

    const averageTheoryScore = Math.round(breakdown.reduce((sum, item) => sum + item.score, 0) / breakdown.length) || 0;

    // Evaluate code programmatically
    const passedCount = codingTestResults ? parseInt(codingTestResults.passedCount) || 0 : 0;
    const totalCount = codingTestResults ? parseInt(codingTestResults.totalCount) || 3 : 3;
    const codingScore = Math.round((passedCount / totalCount) * 100);
    const overallScore = Math.round((averageTheoryScore + codingScore) / 2);

    let codingFeedback = '';
    if (codingScoreDetails && codingScoreDetails.length > 0) {
      codingFeedback = codingScoreDetails.map((detail, idx) => {
        return `**Challenge ${idx + 1}: ${detail.title}**\n` + 
          `- Passed: ${detail.passedCount} / ${detail.totalCount} test cases.\n` +
          `- Review: ${detail.passedCount === detail.totalCount ? 'Excellent work, all tests passed.' : 'Check boundary conditions and logic to resolve failed test cases.'}`;
      }).join('\n\n');
    } else {
      codingFeedback = passedCount === totalCount
        ? `Your solution for "${codingQuestion?.title || 'Coding Challenge'}" successfully passed all ${passedCount}/${totalCount} local test cases! The implementation is clean, logically sound, and correctly solves the problem.`
        : `Your solution for "${codingQuestion?.title || 'Coding Challenge'}" passed ${passedCount} out of ${totalCount} test cases. Review the failing inputs or boundary constraints to trace why the output did not match expectations.`;
    }

    const improvements = overallScore >= 70
      ? ["Deepen architectural explanations.", "Illustrate trade-offs for advanced concepts.", "Optimize code time/space efficiency."]
      : ["Study core definitions and vocabulary.", "Explain concepts in detail rather than keeping answers brief.", "Review standard algorithmic structures to pass all coding cases."];

    if (tabWarningsCount > 0) {
      improvements.push(`Avoid switching browser tabs during the test (detected ${tabWarningsCount} tab changes).`);
    }

    return res.json({
      overallScore,
      strengths: overallScore >= 70 
        ? ["Demonstrated solid comprehension of the topic.", "Used key technical terminology in responses.", "Solved the coding challenge successfully."]
        : ["Attempted to answer core technical questions.", "Clear communication pace.", "Tried to implement the coding task."],
      improvements,
      breakdown,
      codingFeedback,
      generalTips: [
        "Always define the core term first before explaining its benefits.",
        "Talk about tradeoffs when explaining architectural decisions.",
        "Use the STAR method (Situation, Task, Action, Result) for behavioral or complex questions.",
        "Analyze the time and space complexity of your code before declaring it complete."
      ],
      isMock: true
    });
  }

  // GROQ MODE
  const formattedHistory = history.map((h, i) => `Question ${i + 1}: "${h.question}"\nCandidate Answer: "${h.answer || '(No response)'}"`).join('\n\n');
  
  let codeSubmissionInfo = '';
  if (codingScoreDetails && codingScoreDetails.length > 0) {
    codeSubmissionInfo = codingScoreDetails.map((detail, idx) => {
      return `### Challenge ${idx + 1}: "${detail.title}"
Submitted Code:
\`\`\`javascript
${detail.code || '// No code submitted'}
\`\`\`
Test Case Results: Passed ${detail.passedCount} out of ${detail.totalCount} test cases.`;
    }).join('\n\n');
  } else {
    codeSubmissionInfo = `Coding Challenge: "${codingQuestion?.title || 'Challenge'}"
Description: ${codingQuestion?.description || 'N/A'}
Candidate Submitted Code:
\`\`\`javascript
${candidateCode || '// No code submitted'}
\`\`\`
Test Case Results: Passed ${codingTestResults?.passedCount || 0} out of ${codingTestResults?.totalCount || 3} test cases.`;
  }

  const systemPrompt = `You are a professional senior technical recruiter. Evaluate the candidate's performance in both the verbal theory round and the coding test round.
You must return your response in a clean JSON object containing "overallScore", "strengths", "improvements", "breakdown" (array of items), "codingFeedback", and "generalTips" keys.
Each item in the "breakdown" array must be a JSON object containing:
- "question": The exact question asked.
- "answer": The candidate's response.
- "idealAnswer": The technically correct model answer for this question (written clearly in 2-3 sentences).
- "feedback": Constructive, detailed technical evaluation.
- "score": An integer (0-100) reflecting their performance on this question.

SCORING RULES (CRITICAL):
1. Grade the answers strictly against the correct technical definition of the concepts asked.
2. If the candidate's answer is extremely short, irrelevant, gibberish, or says "I don't know", "skip", "pass", or left empty, award a score of EXACTLY 0.
3. Award scores strictly based on the following rubric:
   - 90-100: Complete, accurate, detailed answer with deep technical terminology and code/architectural understanding.
   - 70-89: Generally correct, covers main definitions, but lacks detail or minor aspects are omitted.
   - 40-69: Partially correct or very brief, misses major definitions or concepts.
   - 1-39: Extremely brief or contains major technical inaccuracies.
   - 0: Empty, skipped, or equivalent to "I don't know".
4. If 'Tab switching warning violations count' is greater than 0, you must add a warning under 'improvements' stating: "Ensure compliance with interview guidelines (detected X tab changes)." where X is the count.`;

  const prompt = `Candidate: ${name}
Role/Topic: ${difficulty} level mock interview for the "${topic}" role.
Tab switching warning violations count: ${tabWarningsCount || 0}

Interview Questions and Answers:
${formattedHistory}

Coding Challenge Details:
${codeSubmissionInfo}

Generate a comprehensive performance review. Evaluate both the verbal theory round and the coding challenge submission.
CRITICAL EVALUATION RULES:
1. "overallScore" must be a single aggregated score (0-100) combining both theory answers and coding challenge success.
2. Under "codingFeedback", write a detailed code review (2-3 paragraphs in markdown formatting) evaluating:
   - Functionality & Correctness: Does the code solve the problem? Note that it passed ${codingTestResults?.passedCount || 0}/${codingTestResults?.totalCount || 3} test cases.
   - Time & Space Complexity: Analyze the big-O performance.
   - Code Style: Readability, spacing, variable naming, and cleanliness.
   - Suggestions: How can the candidate improve this code?
3. Under "breakdown", provide a constructive evaluation for each verbal theory question.
4. Award realistic scores. Do not give high scores if the code failed test cases or if verbal answers are empty/brief.

Respond ONLY in this JSON format:
{
  "overallScore": [number from 0 to 100],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "improvements": ["Improvement area 1", "Improvement area 2"],
  "breakdown": [
    {
      "question": "Exact question asked",
      "answer": "Exact candidate answer",
      "idealAnswer": "Ideal technical answer",
      "feedback": "Detailed constructive evaluation (2-3 sentences)",
      "score": [number from 0 to 100]
    }
  ],
  "codingFeedback": "Detailed technical code review markdown...",
  "generalTips": ["Career or technical interview tips related to this topic"]
}`;

  try {
    const aiResponse = await callGroq(prompt, activeKey, systemPrompt);
    res.json({
      ...aiResponse,
      violationScreenshots: violationScreenshots || [],
      isMock: false
    });
  } catch (error) {
    console.error("Groq report generation failed, using mock report:", error);
    // Return mock report with looked up ideal answers on API failure
    const questionsList = getMockQuestionsForTopic(topic);
    const breakdown = history.map((item) => {
      const matchedQ = questionsList.find(q => {
        const questionTextClean = q.question.toLowerCase().trim();
        const itemQuestionClean = item.question.replace(/Hello.*first question\.\s*/, '').toLowerCase().trim();
        return itemQuestionClean.includes(questionTextClean) || questionTextClean.includes(itemQuestionClean);
      }) || { question: item.question, idealAnswer: "A model answer is not available for this question.", keywords: [] };

      return {
        question: item.question,
        answer: item.answer || "(No response)",
        idealAnswer: matchedQ.idealAnswer,
        feedback: "Strong attempt. Review key documentations for optimal performance.",
        score: 75
      };
    });

    let codingFeedbackStr = '';
    if (codingScoreDetails && codingScoreDetails.length > 0) {
      codingFeedbackStr = codingScoreDetails.map((detail, idx) => {
        return `Challenge ${idx + 1}: Passed ${detail.passedCount}/${detail.totalCount} cases.`;
      }).join(', ');
    } else {
      codingFeedbackStr = `Passed ${codingTestResults?.passedCount || 0}/${codingTestResults?.totalCount || 3} test cases.`;
    }
    
    res.json({
      overallScore: 75,
      strengths: ["Clear response delivery.", "Solid structural understanding of the topic.", "Completed the coding test structure."],
      improvements: ["Provide more production-level examples.", "Address edge-cases in technical explanations.", "Analyze time complexity of code."],
      breakdown,
      codingFeedback: `${codingFeedbackStr} Attempted solution for "${codingQuestion?.title || 'Challenge'}". Double check variable initialization and algorithmic logic.`,
      generalTips: ["Structure your answers clearly.", "Practice speaking out loud to build confidence."],
      violationScreenshots: violationScreenshots || [],
      isMock: true
    });
  }
});

// Split text into small chunks to accommodate Google Translate TTS length limits
function splitTextIntoChunks(text, maxLength = 180) {
  const chunks = [];
  let currentChunk = '';

  // Split by sentences first
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // If a single sentence is longer than maxLength, split it by spaces
      if (sentence.length > maxLength) {
        const words = sentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if ((tempChunk + ' ' + word).length <= maxLength) {
            tempChunk += (tempChunk ? ' ' : '') + word;
          } else {
            if (tempChunk) chunks.push(tempChunk.trim());
            tempChunk = word;
          }
        }
        currentChunk = tempChunk;
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// Endpoint 3: Text-to-Speech proxy to route audio to specific output device (headphones)
// Handler for Text-to-Speech synthesis using local Coqui TTS or Google fallback
async function ttsHandler(req, res) {
  try {
    const text = req.query.text || req.body?.text;
    if (!text) {
      return res.status(400).json({ error: "Text parameter is required" });
    }

    // Generate a unique temp file path in OS temp directory
    const tempFile = path.join(os.tmpdir(), `tts_${crypto.randomUUID()}.mp3`);
    console.log(`[Coqui TTS] Synthesizing text: "${text.substring(0, 30)}..." to ${tempFile}`);

    // Spawn the Python process
    const python = spawn('python', [
      path.join(__dirname, 'coqui_tts.py'),
      text,
      tempFile
    ]);

    let stdoutData = '';
    let stderrData = '';

    python.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Timeout logic: if process takes longer than 15 seconds, kill it
    let killedByTimeout = false;
    const timeout = setTimeout(() => {
      console.warn(`[Coqui TTS] Process timed out after 15 seconds. Killing it.`);
      killedByTimeout = true;
      try {
        python.kill();
      } catch (err) {
        console.error("[Coqui TTS] Error killing python process:", err);
      }
    }, 15000);

    // Promise that resolves on process exit/close
    const exitCode = await new Promise((resolve) => {
      python.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      python.on('error', (err) => {
        clearTimeout(timeout);
        console.error("[Coqui TTS] Python process spawn error:", err);
        resolve(-1);
      });
    });

    if (!killedByTimeout && exitCode === 0 && stdoutData.includes("SUCCESS")) {
      try {
        if (fs.existsSync(tempFile)) {
          const buffer = fs.readFileSync(tempFile);
          res.setHeader('Content-Type', 'audio/mpeg');
          res.send(buffer);
          
          // Cleanup temp file asynchronously
          fs.unlink(tempFile, (err) => {
            if (err) console.error("[Coqui TTS] Failed to delete temp file:", err);
          });
          return;
        } else {
          console.warn("[Coqui TTS] Process returned SUCCESS but temp file was not found.");
        }
      } catch (readErr) {
        console.error("[Coqui TTS] Error reading/deleting temp file:", readErr);
      }
    }

    // Coqui failed or timed out. Cleanup temp file and fallback.
    console.warn(`[Coqui TTS] Failed (code: ${exitCode}). stdout: ${stdoutData.trim()}, stderr: ${stderrData.trim()}. Falling back to Google TTS.`);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }

    // Google Translate TTS Fallback
    console.log(`[Google TTS Fallback] Generating speech for text: "${text.substring(0, 30)}..."`);
    const chunks = splitTextIntoChunks(text);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-in&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Google TTS responded with status ${response.status} for chunk: ${chunk}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    const combinedBuffer = Buffer.concat(audioBuffers);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(combinedBuffer);

  } catch (error) {
    console.error("[TTS Proxy] Final fallback error:", error);
    res.status(500).json({ error: "TTS service unavailable" });
  }
}

app.get('/api/tts', ttsHandler);
app.post('/api/tts', ttsHandler);

// Endpoint 4: Real-time Mobile Phone Detection using Groq Vision
app.post('/api/detect-mobile', async (req, res) => {
  try {
    const { image, groqApiKey } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "Image data is required" });
    }

    const primaryKey = groqApiKey || process.env.GROQ_API_KEY;
    const secondaryKey = process.env.SECONDARY_GROQ_API_KEY;

    const keysToTry = [];
    if (primaryKey) {
      keysToTry.push({ key: primaryKey, label: groqApiKey ? "custom frontend" : "primary" });
    }
    if (secondaryKey && secondaryKey !== primaryKey) {
      keysToTry.push({ key: secondaryKey, label: "secondary fallback" });
    }

    if (keysToTry.length === 0) {
      return res.status(500).json({ success: false, error: "GROQ_API_KEY is not configured on the server or frontend" });
    }

    const systemPrompt = `You are a strict proctoring system for an online interview.
Your ONLY job is to detect if a mobile phone or smartphone is 
visible anywhere in the image.

Respond ONLY with valid JSON in this exact format:
{
  "mobile_detected": true or false,
  "confidence": "high" or "medium" or "low",
  "location": "brief description of where in frame, or null",
  "box_2d": [ymin, xmin, ymax, xmax] or null
}

Rules & Guidelines:
- Pay extreme attention to the laptop display, laptop screen, and screen bezels. 
- Detect if a mobile phone is placed on, resting on, leaning against, or mounted on/near the laptop display, screen bezel, keyboard area, or desk nearby.
- Look for smartphones resting vertically or horizontally on the top, bottom, or sides of the laptop screen, which may show a camera bump, phone screen, side profile, or phone bezel.
- Set "mobile_detected" to true if ANY part of a phone is visible (screen, body, camera module, edge, or hand holding phone).
- Set "mobile_detected" to true if someone appears to be looking down at a device in their lap or off-screen.
- If "mobile_detected" is true, estimate the normalized bounding box coordinates [ymin, xmin, ymax, xmax] of the phone in the 0-1000 range. E.g. [350, 420, 750, 850]. Set "box_2d" to null if not detected or uncertain.
- Set "mobile_detected" to false ONLY if there is absolutely no phone evidence or device visible.
- Do NOT explain. JSON only.`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${image}`
            }
          },
          {
            type: "text",
            text: "Scan this camera frame for mobile phone usage."
          }
        ]
      }
    ];

    const visionModels = [
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
      "meta-llama/llama-4-scout-17b-16e-instruct"
    ];

    let lastError = null;
    for (const keyObj of keysToTry) {
      const activeKey = keyObj.key;
      console.log(`[Groq Vision API] Attempting call with ${keyObj.label} API Key`);

      for (const model of visionModels) {
        try {
          console.log(`[Groq Vision API] Testing model "${model}"`);
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
            },
            body: JSON.stringify({
              model,
              messages,
              response_format: {
                type: "json_object"
              },
              temperature: 0.2
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API model "${model}" responded with status ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const responseText = data.choices?.[0]?.message?.content;
          if (!responseText) {
            throw new Error(`Received empty message content from Groq Vision API model "${model}"`);
          }

          const parsedJSON = JSON.parse(responseText.trim());
          console.log(`[Groq Vision API] Success using model "${model}" and ${keyObj.label} key`);

          let savedScreenshotPath = null;
          if (parsedJSON.mobile_detected) {
            try {
              const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
              const imageBuffer = Buffer.from(base64Data, 'base64');
              const jimpImage = await Jimp.read(imageBuffer);
              
              const imgWidth = jimpImage.bitmap.width;
              const imgHeight = jimpImage.bitmap.height;

              // Draw box if coordinates are provided
              if (parsedJSON.box_2d && Array.isArray(parsedJSON.box_2d) && parsedJSON.box_2d.length === 4) {
                const ymin = Math.round((parsedJSON.box_2d[0] / 1000) * imgHeight);
                const xmin = Math.round((parsedJSON.box_2d[1] / 1000) * imgWidth);
                const ymax = Math.round((parsedJSON.box_2d[2] / 1000) * imgHeight);
                const xmax = Math.round((parsedJSON.box_2d[3] / 1000) * imgWidth);

                const x = Math.max(0, xmin);
                const y = Math.max(0, ymin);
                const w = Math.min(imgWidth - x, xmax - xmin);
                const h = Math.min(imgHeight - y, ymax - ymin);

                if (w > 0 && h > 0) {
                  const colorHex = 0xff0000ff; // Red border
                  const thickness = 4;
                  for (let t = 0; t < thickness; t++) {
                    for (let cx = x; cx < x + w; cx++) {
                      if (cx >= 0 && cx < imgWidth) {
                        if (y + t >= 0 && y + t < imgHeight) jimpImage.setPixelColor(colorHex, cx, y + t);
                        if (y + h - 1 - t >= 0 && y + h - 1 - t < imgHeight) jimpImage.setPixelColor(colorHex, cx, y + h - 1 - t);
                      }
                    }
                    for (let cy = y; cy < y + h; cy++) {
                      if (cy >= 0 && cy < imgHeight) {
                        if (x + t >= 0 && x + t < imgWidth) jimpImage.setPixelColor(colorHex, x + t, cy);
                        if (x + w - 1 - t >= 0 && x + w - 1 - t < imgWidth) jimpImage.setPixelColor(colorHex, x + w - 1 - t, cy);
                      }
                    }
                  }
                }
              }

              const violationsDir = path.join(__dirname, 'public', 'violations');
              if (!fs.existsSync(violationsDir)) {
                fs.mkdirSync(violationsDir, { recursive: true });
              }

              const filename = `violation_${Date.now()}.jpg`;
              const filePath = path.join(violationsDir, filename);
              await jimpImage.write(filePath);
              savedScreenshotPath = `/violations/${filename}`;
              console.log(`[Groq Vision API] Saved violation screenshot to ${filePath}`);
            } catch (saveErr) {
              console.error("[Groq Vision API] Failed to save screenshot or draw box:", saveErr);
            }
          }

          return res.json({
            success: true,
            mobile_detected: !!parsedJSON.mobile_detected,
            confidence: parsedJSON.confidence || "low",
            location: parsedJSON.location || null,
            screenshot: savedScreenshotPath
          });
        } catch (error) {
          console.warn(`[Groq Vision API] Warning: ${keyObj.label} API Key with model "${model}" failed. Error: ${error.message}`);
          lastError = error;

          if (error.message.includes("status 401") || error.message.includes("status 403")) {
            console.warn(`[Groq Vision API] Auth/Access error. Skipping remaining models for this key.`);
            break;
          }
        }
      }
    }

    throw lastError || new Error("All Groq Vision attempts failed.");
  } catch (error) {
    console.error("Error in /api/detect-mobile route:", error);
    return res.json({ success: false, error: error.message });
  }
});

// WebRTC Signaling storage for secondary mobile camera connection
const webrtcSessions = new Map();

app.post('/api/webrtc/offer', (req, res) => {
  const { sessionId, offer } = req.body;
  if (!sessionId || !offer) {
    return res.status(400).json({ success: false, error: "sessionId and offer are required" });
  }
  webrtcSessions.set(sessionId, { offer, answer: null, timestamp: Date.now() });
  return res.json({ success: true });
});

app.get('/api/webrtc/offer', (req, res) => {
  const { sessionId } = req.query;
  const session = webrtcSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  return res.json({ success: true, offer: session.offer });
});

app.post('/api/webrtc/answer', (req, res) => {
  const { sessionId, answer } = req.body;
  const session = webrtcSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  session.answer = answer;
  return res.json({ success: true });
});

app.get('/api/webrtc/answer', (req, res) => {
  const { sessionId } = req.query;
  const session = webrtcSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: "Session not found" });
  }
  return res.json({ success: true, answer: session.answer });
});

// Periodic session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of webrtcSessions.entries()) {
    if (now - value.timestamp > 1800000) { // 30 minutes
      webrtcSessions.delete(key);
    }
  }
}, 60000);

// Endpoint to retrieve the local network IP for WebRTC QR code
app.get('/api/network-ip', (req, res) => {
  try {
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    const ip = addresses[0] || 'localhost';
    res.json({ success: true, ip });
  } catch (error) {
    res.json({ success: false, error: error.message, ip: 'localhost' });
  }
});

// Start the server
const useHttps = fs.existsSync('key.pem') && fs.existsSync('cert.pem');
const server = useHttps
  ? https.createServer({
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem')
    }, app)
  : app;

server.listen(PORT, '0.0.0.0', () => {
  const activeModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  const scheme = useHttps ? 'https' : 'http';
  console.log(`=======================================================`);
  console.log(` AI Interviewer Server running on all interfaces (0.0.0.0)`);
  console.log(` Protocol:  ${useHttps ? 'HTTPS (Secure)' : 'HTTP (Insecure - Mobile cameras might block)'}`);
  console.log(` - Local:   ${scheme}://localhost:${PORT}`);
  addresses.forEach(addr => {
    console.log(` - Network: ${scheme}://${addr}:${PORT}`);
  });
  const modeString = GROQ_API_KEY 
    ? `Groq Mode (Primary: ${activeModel}, Fallback Active)` 
    : (SECONDARY_GROQ_API_KEY ? `Groq Mode (Fallback API Key active)` : 'Offline/Mock Fallback Mode');
  console.log(` Environment: ${modeString}`);
  console.log(`=======================================================`);
});
