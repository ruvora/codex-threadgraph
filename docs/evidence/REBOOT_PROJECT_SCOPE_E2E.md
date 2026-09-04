# Reboot project-scope E2E

Date: 2026-09-04  
Host: Codex desktop on macOS  
Source revision: `codex/fix-project-path-contract`

## Purpose

Verify the installed plugin after a desktop restart, then reproduce and close any contract gap before publishing another graph revision.

## Installed-plugin observation

The restarted desktop discovered the installed ThreadGraph tools from `0.1.0+codex.20260904073659`.

The first `threadgraph_prepare_index` call supplied the host project identifier as `canonicalProjectId`, as required by the public tool schema. The MCP transport closed while starting the Codex App Server. A direct JSON-RPC reproduction exposed the cause:

```text
spawn /Applications/ChatGPT.app/Contents/Resources/codex ENOENT
```

The executable existed. Node reported `ENOENT` because the same identifier had also been passed as the child process working directory. The contract had conflated two values:

- stable host project ID, which defines graph identity;
- absolute local project path, which defines the read-only App Server scope.

Using a real directory in the old field confirmed that source discovery itself still worked, but that workaround would make graph identity depend on a filesystem path and was therefore rejected as a product contract.

## Corrected contract

`threadgraph_prepare_index` now requires both values:

- `canonicalProjectId`: stable host project ID; never used as a filesystem path;
- `canonicalProjectPath`: canonical absolute directory; never used as graph identity.

The path is validated before App Server startup. Spawn failure is returned as `HOST_START_FAILED` and no longer closes the MCP process. The frozen indexing request records and fingerprints both values.

## Verification

The complete automated suite passed:

```text
tests 83
pass 83
fail 0
```

The regression coverage verifies:

- both project fields are required by the MCP schema;
- an identifier used as a path is rejected as `PROJECT_PATH_INVALID`;
- the same MCP process answers a subsequent request after rejection;
- an unavailable Codex executable returns `HOST_START_FAILED` without terminating the caller;
- persisted requests retain the stable ID and canonical path separately.

A source-level forward test used the desktop's real Codex App Server with the saved project record for `/Users/sin-yebin/Desktop/baseball`. It prepared a bounded index session from the stable project ID and absolute project path, then cancelled it immediately:

```text
ok: true
semantic sources: 1
terminal session status: cancelled
```

No graph revision was published and no native Codex thread was started or modified.

## Remaining release boundary

This evidence validates the corrected source revision against the real host. It does not claim that the currently installed cache contains the correction. Final installed-plugin acceptance requires merging this change, updating the personal marketplace cachebuster, reinstalling while no old MCP proxy is active, restarting Codex, and repeating prepare/cancel through the discovered plugin tool.
