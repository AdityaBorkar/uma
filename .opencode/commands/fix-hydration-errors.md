---
description: Fix hydration errors in the codebase
agent: build
subtask: false
---

# Fix hydration errors

You are an expert frontend engineer specializing in SSR (Server-Side Rendering) and hydration correctness. Your task is to analyze the provided codebase and identify hydration errors caused by INVALID HTML element nesting and DOM structure mismatches between server and client. Focus specifically on detecting and fixing invalid nesting involving these elements:

## CRITICAL INVALID NESTING CASES

- <div> inside <p>
- <p> inside <p>
- <p> wrapping block elements (<div>, <section>, <article>, <header>, <footer>, <main>, <aside>)
- <a> inside <a>
- <button> inside <button>
- <button> inside <a> and <a> inside <button>
- <form> inside <form>
- <label> inside <label>
- interactive elements inside interactive elements:
  - <button> inside <button>
  - <button> inside <a>
  - <a> inside <button>
  - <input> inside <button>
  - <select> inside <button>
  - <textarea> inside <button>

### TABLE STRUCTURE VIOLATIONS

- Missing required structure:
  - <tr> must be inside <thead>, <tbody>, or <tfoot>
  - <td> or <th> must be inside <tr>
  - <thead>, <tbody>, <tfoot> must be inside <table>
- Invalid nesting like:
  - <div> inside <table> (without proper wrapper)
  - <div> inside <tr>
  - <div> inside <tbody>

### LIST STRUCTURE VIOLATIONS

- Only <li> allowed directly inside:
  - <ul>
  - <ol>
- Invalid examples:
  - <div> inside <ul>
  - <div> inside <ol>

### OTHER STRUCTURAL VIOLATIONS

- Block elements inside inline elements:
  - <div> inside <span>
  - <section> inside <span>
  - <article> inside <span>
- Nested <html>, <body>, or <head> tags
- Conditional rendering that causes different element types between server and client

### HYDRATION-SPECIFIC PROBLEMS

- Conditional rendering based on:
  - window
  - document
  - navigator
  - localStorage
  - screen size
  - Date.now()
  - Math.random()
- Dynamic element type switching between server and client
- Components rendering different wrapper elements on client vs server

## YOUR TASK

1. Identify all invalid nesting issues.
2. Identify all hydration mismatch risks caused by nesting.
3. Fix the nesting by restructuring the DOM correctly.
4. Preserve layout and styling intent.
5. Do NOT introduce hydration mismatches.
6. Prefer semantic HTML.
7. Ensure SSR and client DOM trees are identical.
