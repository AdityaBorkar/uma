# TODO

Model Providers
+ Add Provider
+ Add Model
+ Add Account

Create a add button with inputs:
Provider Name
Provider Base URL

then auto-detect models by querying `GET $BASE_URL/models`
and show the list of models with:
Model Name, Model ID, Max. Output Tokens, Max. Input Tokens, Image Support?, Video Support?, Audio Support?, PDF Support?, Reasoning Variants [], Price (Input/Output/Cache Read/Cache Write/...)

then save it/

https://hyper.charm.land/v1/
https://hyper.charm.land/v1/models

---

get @machine completely done in code quality by 3PM (25 mins)

Reorganize the code, verify the commands and RPC

Connect machine to the server
/debug
- Ensure a Sandbox Server to test the connection and execute anything arbitrary and ensuring results.

bun dev
Pulumi postgres database

link orpc contract
rest like contract

retire all old-repo except webapp

--- Complete by 12PM ---

- DB -> remote-servers
- Gain FS Access (uma-projects) (flat-file-structure)
- remote-server
  - projects.CRUD
  - agents.CRUD
  - agents.config.CRUD
  - sessions.CRUD

## Later

- Deploy on Cloudflare Network
- CockroachDB as database
- Do not use Cloudflare SSL Termination (it is insecure and gives CF access to MITM)
