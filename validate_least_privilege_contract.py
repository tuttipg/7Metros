"""Static fail-closed guard for the unapplied least-privilege SQL draft.

This checks text only; it does not connect to PostgreSQL or prove runtime grants.
"""

from pathlib import Path
import re
import sys

DRAFT = Path(__file__).resolve().parent / 'supabase/drafts/authenticated_least_privilege.sql'
OWNERS = ('postgres', 'supabase_admin')
FORBIDDEN_CRUD = {'select', 'insert', 'update', 'delete'}
ALLOWED = {'truncate', 'trigger', 'references', 'maintain'}


def check_contract(source: str) -> list[str]:
    # This draft has no SQL string literals containing '--'. Strip commentary
    # so commented-out statements cannot satisfy executable SQL guards.
    executable = '\n'.join(line.split('--', 1)[0] for line in source.splitlines())
    executable = re.sub(r'\s+', ' ', executable.lower()).strip()
    statements = [part.strip() for part in executable.split(';') if part.strip()]
    errors = []
    if not statements or statements[0] != 'begin' or statements[-1] != 'commit':
        errors.append('missing explicit begin/commit transaction')

    actual = {}
    for statement in statements[1:-1]:
        current = re.fullmatch(
            r'revoke (.+?) on all tables in schema public from (anon|authenticated)',
            statement,
        )
        future = re.fullmatch(
            r'alter default privileges for role (postgres|supabase_admin) in schema public '
            r'revoke (.+?) on tables from (anon|authenticated)',
            statement,
        )
        if current:
            privileges, role = current.groups()
            key = ('current', role)
        elif future:
            owner, privileges, role = future.groups()
            key = (owner, role)
        else:
            errors.append(f'unexpected executable SQL: {statement[:100]}')
            continue
        privileges_set = {p.strip() for p in privileges.split(',')}
        if not privileges_set or '' in privileges_set:
            errors.append(f'malformed privilege list for {key}')
        if privileges_set - ALLOWED:
            errors.append(f'unexpected privileges for {key}: {sorted(privileges_set - ALLOWED)}')
        if privileges_set & FORBIDDEN_CRUD:
            errors.append(f'legitimate CRUD privileges revoked for {key}')
        if key in actual:
            errors.append(f'duplicate revoke scope: {key}')
        actual[key] = privileges_set

    expected = {
        ('current', 'authenticated'): {'truncate', 'trigger', 'references', 'maintain'},
        ('current', 'anon'): {'maintain'},
    }
    for owner in OWNERS:
        expected[(owner, 'authenticated')] = {'truncate', 'trigger', 'references', 'maintain'}
        expected[(owner, 'anon')] = {'maintain'}
    for key, required in expected.items():
        missing = required - actual.get(key, set())
        if missing:
            errors.append(f'{key}: missing revocations {sorted(missing)}')
    if len(actual) != len(expected):
        errors.append('unexpected or missing revocation scope')
    return errors


def self_test(source: str) -> list[str]:
    failures = []
    if check_contract(source):
        failures.append('original draft fails static contract')
        return failures
    variants = {
        'missing existing-object revoke': source.replace(
            'revoke maintain\n  on all tables', '-- revoke maintain\n  on all tables', 1
        ),
        'missing default owner': source.replace(
            'for role supabase_admin', 'for role another_owner'
        ),
        'missing capability': source.replace(
            'truncate, trigger, references, maintain', 'truncate, trigger, references'
        ),
        'unwanted CRUD revoke': source.replace(
            'revoke maintain\n  on all tables', 'revoke maintain, select\n  on all tables', 1
        ),
        'unexpected grant': source.replace(
            'commit;', 'grant all on all tables in schema public to anon;\ncommit;', 1
        ),
    }
    for label, altered in variants.items():
        if not check_contract(altered):
            failures.append(f'mutation not detected: {label}')
    return failures


def main() -> int:
    if not DRAFT.is_file():
        print('LEAST PRIVILEGE CONTRACT FAILED: SQL draft missing')
        return 1
    source = DRAFT.read_text(encoding='utf-8')
    errors = check_contract(source)
    if '-- safe draft only.' not in source.lower() or 'outside supabase/migrations/' not in source.lower():
        errors.append('missing explicit draft-only / no-migration warning')
    if '--self-test' in sys.argv:
        errors += self_test(source)
    if errors:
        print('LEAST PRIVILEGE CONTRACT FAILED')
        for error in errors:
            print('-', error)
        return 1
    print('OK: static least-privilege draft contract; no database operations')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
