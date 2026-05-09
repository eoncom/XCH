"""
gen_dsn ORM helper — exécuté par gen-dsn.sh via `docker exec ... manage.py shell`.

À NE PAS appeler directement depuis l'hôte. Inputs via env vars (positionnés
par gen-dsn.sh côté `docker exec -e ...`):

  GEN_DSN_ORG_SLUG       slug de l'organisation à créer/réutiliser (ex: xch)
  GEN_DSN_ORG_NAME       nom affiché de l'organisation (ex: XCH)
  GEN_DSN_ADMIN_EMAIL    email du super-admin à associer comme Owner de l'org
                         + member de la team (sinon le super-admin ne voit rien
                         dans la UI GlitchTip — bug rencontré item 6 et fixé)
  GEN_DSN_DRY_RUN        "1" pour ne rien créer (audit only), "0" sinon
  GEN_DSN_INTERNAL_HOST  base URL pour DSN backend/worker (ex: http://glitchtip-web:8000)
  GEN_DSN_PUBLIC_HOST    base URL pour DSN frontend (ex: https://glitch.eoncom.io)
  GEN_DSN_PROJECTS_JSON  JSON list `[{"slug":"...","platform":"...","audience":"internal|public"}, ...]`

Output : JSON unique entre marqueurs ===GEN_DSN_JSON_BEGIN=== / ===GEN_DSN_JSON_END===.
Tout audit (GET vs CREATE/WOULD_CREATE) est inclus dans le JSON.

Coupling assumé : modèles `apps.organizations_ext.models.{Organization,
OrganizationUser, OrganizationOwner}`, `apps.teams.models.Team`,
`apps.projects.models.{Project,ProjectKey}` ; valable pour
glitchtip/glitchtip:v4.1 (image pinnée dans docker-compose.glitchtip.yml).
"""
import json
import os
import re
import sys
import traceback

from django.db import transaction

ORG_SLUG = os.environ["GEN_DSN_ORG_SLUG"]
ORG_NAME = os.environ.get("GEN_DSN_ORG_NAME", ORG_SLUG.upper())
ADMIN_EMAIL = os.environ.get("GEN_DSN_ADMIN_EMAIL", "").strip() or None
DRY_RUN = os.environ.get("GEN_DSN_DRY_RUN", "0") == "1"
INTERNAL_HOST = os.environ["GEN_DSN_INTERNAL_HOST"].rstrip("/")
PUBLIC_HOST = os.environ["GEN_DSN_PUBLIC_HOST"].rstrip("/")
PROJECTS = json.loads(os.environ["GEN_DSN_PROJECTS_JSON"])

audit = []
errors = []


def _log_get(label, key, obj):
    audit.append({"action": "GET", "type": label, "key": key, "id": obj.pk})


def _log_create(label, key, obj):
    audit.append({"action": "CREATE", "type": label, "key": key, "id": obj.pk})


def _log_would_create(label, key):
    audit.append({"action": "WOULD_CREATE", "type": label, "key": key})


def _build_dsn(audience, public_key_hex, project_id):
    base = INTERNAL_HOST if audience == "internal" else PUBLIC_HOST
    m = re.match(r"^(https?)://(.+)$", base)
    if not m:
        raise ValueError(f"INTERNAL/PUBLIC host '{base}' must start with http:// or https://")
    scheme, hostport = m.group(1), m.group(2).rstrip("/")
    return f"{scheme}://{public_key_hex}@{hostport}/{project_id}"


def main():
    from apps.organizations_ext.models import (
        Organization,
        OrganizationUser,
        OrganizationOwner,
    )
    from apps.teams.models import Team
    from apps.projects.models import Project, ProjectKey
    from django.contrib.auth import get_user_model

    dsns = {}

    org = Organization.objects.filter(slug=ORG_SLUG).first()
    org_key = {"slug": ORG_SLUG}
    if org is not None:
        _log_get("Organization", org_key, org)
    elif DRY_RUN:
        _log_would_create("Organization", org_key)
    else:
        org = Organization.objects.create(slug=ORG_SLUG, name=ORG_NAME)
        _log_create("Organization", org_key, org)

    team = None
    if org is not None:
        team = Team.objects.filter(organization=org, slug=ORG_SLUG).first()
        team_key = {"organization_slug": ORG_SLUG, "slug": ORG_SLUG}
        if team is not None:
            _log_get("Team", team_key, team)
        elif DRY_RUN:
            _log_would_create("Team", team_key)
        else:
            team = Team.objects.create(organization=org, slug=ORG_SLUG)
            _log_create("Team", team_key, team)

    # Membership : sans OrganizationUser, le super-admin n'a aucune visibilité
    # sur l'org dans la UI GlitchTip ("you'll need to create an organization").
    # Bug découvert lors de la validation runtime item 6 ; fix : associer
    # l'admin email (lu depuis glitchtip/.env via GEN_DSN_ADMIN_EMAIL) comme
    # Owner de l'org + member de la team. Idempotent via get_or_create.
    if org is not None and team is not None and ADMIN_EMAIL and not DRY_RUN:
        U = get_user_model()
        admin = U.objects.filter(email=ADMIN_EMAIL).first()
        if admin is None:
            errors.append(
                f"admin user {ADMIN_EMAIL!r} introuvable — "
                "vérifier glitchtip-admin-seed exit 0 (createsuperuser)"
            )
        else:
            ou_key = {"organization_slug": ORG_SLUG, "user_email": ADMIN_EMAIL}
            ou, ou_created = OrganizationUser.objects.get_or_create(
                user=admin,
                organization=org,
                defaults={"role": 3, "email": ADMIN_EMAIL},  # 3 = Owner
            )
            if ou_created:
                _log_create("OrganizationUser", ou_key, ou)
            else:
                _log_get("OrganizationUser", ou_key, ou)

            oo_key = {"organization_slug": ORG_SLUG}
            oo, oo_created = OrganizationOwner.objects.get_or_create(
                organization=org, defaults={"organization_user": ou}
            )
            if oo_created:
                _log_create("OrganizationOwner", oo_key, oo)
            else:
                _log_get("OrganizationOwner", oo_key, oo)

            # Team.members est une M2M vers OrganizationUser ; .add() est
            # idempotent (no-op si déjà présent).
            team.members.add(ou)
            audit.append({
                "action": "ENSURE",
                "type": "TeamMembership",
                "key": {"team_slug": ORG_SLUG, "user_email": ADMIN_EMAIL},
            })
    elif org is not None and not DRY_RUN and not ADMIN_EMAIL:
        errors.append(
            "GEN_DSN_ADMIN_EMAIL non fourni — admin pas associé comme Owner. "
            "Sans ça, le super-admin ne verra rien dans la UI GlitchTip."
        )

    for spec in PROJECTS:
        slug = spec["slug"]
        platform = spec["platform"]
        audience = spec["audience"]
        if audience not in ("internal", "public"):
            errors.append(f"project {slug}: audience must be internal or public, got {audience!r}")
            continue
        proj_key = {"organization_slug": ORG_SLUG, "slug": slug}

        if org is None:
            # DRY_RUN org doesn't exist — log would-create then skip key
            _log_would_create("Project", proj_key)
            continue

        proj = Project.objects.filter(organization=org, slug=slug).first()
        if proj is not None:
            _log_get("Project", proj_key, proj)
        elif DRY_RUN:
            _log_would_create("Project", proj_key)
            continue
        else:
            proj = Project.objects.create(
                organization=org, slug=slug, name=slug, platform=platform
            )
            _log_create("Project", proj_key, proj)

        if team is not None and not DRY_RUN:
            proj.teams.add(team)

        key = proj.projectkey_set.first()
        key_key = {"project_slug": slug}
        if key is not None:
            _log_get("ProjectKey", key_key, key)
        elif DRY_RUN:
            _log_would_create("ProjectKey", key_key)
            continue
        else:
            key = ProjectKey.objects.create(project=proj)
            _log_create("ProjectKey", key_key, key)

        public_key_hex = key.public_key.hex
        dsn = _build_dsn(audience, public_key_hex, proj.id)
        dsns[slug] = {
            "audience": audience,
            "platform": platform,
            "project_id": proj.id,
            "public_key": public_key_hex,
            "dsn": dsn,
        }

    return {
        "org": {"slug": ORG_SLUG, "name": ORG_NAME, "id": org.pk if org else None},
        "team": {"slug": ORG_SLUG, "id": team.pk if team else None},
        "dry_run": DRY_RUN,
        "audit": audit,
        "dsns": dsns,
        "errors": errors,
    }


try:
    if DRY_RUN:
        # En dry-run, on enveloppe quand même dans une transaction qu'on rollback,
        # pour que les filter().first() voient un état propre sans risque de
        # fuite si un .create() involontaire passe (ceinture+bretelles).
        sid = transaction.savepoint()
        try:
            result = main()
        finally:
            transaction.savepoint_rollback(sid)
    else:
        result = main()
    print("===GEN_DSN_JSON_BEGIN===")
    print(json.dumps(result, indent=2, default=str))
    print("===GEN_DSN_JSON_END===")
except Exception as exc:
    print("===GEN_DSN_JSON_BEGIN===")
    print(json.dumps({
        "error": str(exc),
        "traceback": traceback.format_exc(),
        "audit": audit,
    }, indent=2, default=str))
    print("===GEN_DSN_JSON_END===")
    sys.exit(1)
