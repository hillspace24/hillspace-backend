/**
 * Escrow happy-path + branch smoke tests.
 * Usage: BASE_URL=http://localhost:3000 node scripts/escrow-smoke.mjs
 */
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const stamp = Date.now();
const password = 'SmokeTest123!';

const results = [];
const ok = (name, detail = '') => {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, detail = '') => {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function req(method, path, { token, body, expect } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (expect !== undefined && res.status !== expect) {
    const err = new Error(
      `expected ${expect}, got ${res.status}: ${JSON.stringify(data).slice(0, 400)}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function register(email, role, phoneTail) {
  return req('POST', '/api/auth/register', {
    body: {
      firstName: 'Escrow',
      lastName: role,
      email,
      phone: `+23470${phoneTail}`,
      password,
      role,
    },
  });
}

async function createPublishedListing(sellerToken, title) {
  const created = await req('POST', '/api/listings', {
    token: sellerToken,
    body: {
      title,
      description: 'Escrow smoke listing',
      propertyType: 'apartment',
      purpose: 'sale',
      category: '2_bedroom',
      price: 5000000,
      currency: 'NGN',
      bedrooms: 2,
      bathrooms: 2,
      location: {
        address: '1 Escrow Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
      },
      status: 'draft',
    },
  });
  if (![200, 201].includes(created.status)) {
    throw new Error(`create listing ${created.status} ${JSON.stringify(created.data).slice(0, 200)}`);
  }
  const id = created.data._id || created.data.id;
  const pub = await req('POST', `/api/listings/${id}/publish`, { token: sellerToken });
  if (![200, 201].includes(pub.status)) {
    throw new Error(`publish ${pub.status} ${JSON.stringify(pub.data).slice(0, 200)}`);
  }
  return id;
}

async function main() {
  console.log(`\nEscrow smoke → ${BASE}\n`);

  // Auth fixtures
  let buyerToken;
  let sellerToken;
  try {
    const buyer = await register(
      `escrow.buyer.${stamp}@hillspace.test`,
      'buyer',
      `${String(stamp).slice(-8)}`,
    );
    if ([200, 201].includes(buyer.status) && buyer.data?.accessToken) {
      buyerToken = buyer.data.accessToken;
      ok('register buyer');
    } else fail('register buyer', `${buyer.status}`);
  } catch (e) {
    fail('register buyer', e.message);
  }

  try {
    const seller = await register(
      `escrow.seller.${stamp}@hillspace.test`,
      'seller',
      `${String(stamp + 1).slice(-8)}`,
    );
    if ([200, 201].includes(seller.status) && seller.data?.accessToken) {
      sellerToken = seller.data.accessToken;
      ok('register seller');
    } else fail('register seller', `${seller.status}`);
  } catch (e) {
    fail('register seller', e.message);
  }

  // Unauth
  try {
    await req('GET', '/api/escrow/me', { expect: 401 });
    ok('GET /escrow/me → 401 unauth');
  } catch (e) {
    fail('GET /escrow/me unauth', e.message);
  }

  // Happy path: initiated → funded → inspection → released
  let listingId;
  let escrowId;
  if (buyerToken && sellerToken) {
    try {
      listingId = await createPublishedListing(sellerToken, `Escrow Happy ${stamp}`);
      ok('listing published for escrow', listingId);
    } catch (e) {
      fail('listing fixture', e.message);
    }

    if (listingId) {
      // seller cannot create
      try {
        await req('POST', '/api/escrow', {
          token: sellerToken,
          body: { listingId, amount: 5000000, currency: 'NGN' },
          expect: 403,
        });
        ok('seller cannot create escrow → 403');
      } catch (e) {
        // Nest RolesGuard may return 403; Forbidden might be 403
        if (e.status === 401) fail('seller create role', e.message);
        else if (e.status === 403) ok('seller cannot create escrow → 403');
        else fail('seller create role', e.message);
      }

      try {
        const created = await req('POST', '/api/escrow', {
          token: buyerToken,
          body: { listingId, amount: 5000000, currency: 'NGN' },
        });
        if ([200, 201].includes(created.status)) {
          escrowId = created.data._id || created.data.id;
          ok('POST /escrow create', `status=${created.data.status} id=${escrowId}`);
          if (created.data.status !== 'initiated') {
            fail('create status initiated', created.data.status);
          } else ok('escrow status initiated');
        } else {
          fail('POST /escrow create', `${created.status} ${JSON.stringify(created.data).slice(0, 250)}`);
        }
      } catch (e) {
        fail('POST /escrow create', e.message);
      }
    }

    if (escrowId) {
      try {
        const mine = await req('GET', '/api/escrow/me', { token: buyerToken, expect: 200 });
        const n = Array.isArray(mine.data) ? mine.data.length : 0;
        if (n >= 1) ok('GET /escrow/me (buyer)', `count=${n}`);
        else fail('GET /escrow/me', `count=${n}`);
      } catch (e) {
        fail('GET /escrow/me', e.message);
      }

      try {
        const one = await req('GET', `/api/escrow/${escrowId}`, {
          token: buyerToken,
          expect: 200,
        });
        ok('GET /escrow/:id', one.data.status);
      } catch (e) {
        fail('GET /escrow/:id', e.message);
      }

      try {
        const funded = await req('POST', `/api/escrow/${escrowId}/fund`, {
          token: buyerToken,
          body: { fundingReference: `TRF-SMOKE-${stamp}`, note: 'smoke fund' },
        });
        if ([200, 201].includes(funded.status) && funded.data.status === 'funded') {
          ok('POST fund → funded');
        } else {
          fail('POST fund', `${funded.status} ${JSON.stringify(funded.data).slice(0, 250)}`);
        }
      } catch (e) {
        fail('POST fund', e.message);
      }

      try {
        const insp = await req('POST', `/api/escrow/${escrowId}/inspection`, {
          token: buyerToken,
          body: { note: 'smoke inspection' },
        });
        if ([200, 201].includes(insp.status) && insp.data.status === 'inspection') {
          ok('POST inspection → inspection');
        } else {
          fail('POST inspection', `${insp.status} ${JSON.stringify(insp.data).slice(0, 250)}`);
        }
      } catch (e) {
        fail('POST inspection', e.message);
      }

      try {
        const released = await req('POST', `/api/escrow/${escrowId}/release`, {
          token: buyerToken,
          body: { note: 'smoke release' },
        });
        if ([200, 201].includes(released.status) && released.data.status === 'released') {
          ok('POST release → released');
        } else {
          fail('POST release', `${released.status} ${JSON.stringify(released.data).slice(0, 250)}`);
        }
      } catch (e) {
        fail('POST release', e.message);
      }

      try {
        const listing = await req('GET', `/api/listings/${listingId}`, { expect: 200 });
        if (listing.data.status === 'sold') ok('listing marked sold after release');
        else fail('listing sold', listing.data.status);
      } catch (e) {
        fail('listing sold check', e.message);
      }

      try {
        const receipt = await req('GET', `/api/escrow/${escrowId}/receipt`, {
          token: buyerToken,
          expect: 200,
        });
        ok('GET receipt', typeof receipt.data === 'object' ? 'ok' : String(receipt.status));
      } catch (e) {
        fail('GET receipt', e.message);
      }
    }
  }

  // Cancel branch (separate listing/escrow)
  if (buyerToken && sellerToken) {
    try {
      const lid = await createPublishedListing(sellerToken, `Escrow Cancel ${stamp}`);
      const created = await req('POST', '/api/escrow', {
        token: buyerToken,
        body: { listingId: lid, amount: 1000000 },
      });
      const eid = created.data?._id || created.data?.id;
      if (!eid) throw new Error(`create failed ${created.status}`);
      const cancelled = await req('POST', `/api/escrow/${eid}/cancel`, {
        token: buyerToken,
        body: { note: 'smoke cancel' },
      });
      if ([200, 201].includes(cancelled.status) && cancelled.data.status === 'cancelled') {
        ok('POST cancel → cancelled');
      } else {
        fail('POST cancel', `${cancelled.status} ${JSON.stringify(cancelled.data).slice(0, 250)}`);
      }
      const listing = await req('GET', `/api/listings/${lid}`, { expect: 200 });
      if (listing.data.status === 'active') ok('listing restored active after cancel');
      else fail('listing after cancel', listing.data.status);
      // cleanup listing
      await req('DELETE', `/api/listings/${lid}`, { token: sellerToken });
    } catch (e) {
      fail('cancel branch', e.message);
    }
  }

  // Dispute + refund branch
  if (buyerToken && sellerToken) {
    try {
      const lid = await createPublishedListing(sellerToken, `Escrow Dispute ${stamp}`);
      const created = await req('POST', '/api/escrow', {
        token: buyerToken,
        body: { listingId: lid, amount: 2000000 },
      });
      const eid = created.data?._id || created.data?.id;
      await req('POST', `/api/escrow/${eid}/fund`, {
        token: buyerToken,
        body: { fundingReference: `TRF-DISP-${stamp}` },
      });
      const disputed = await fetch(`${BASE}/api/escrow/${eid}/dispute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${buyerToken}` },
        body: (() => {
          const fd = new FormData();
          fd.append('reason', 'Property not as described (smoke)');
          fd.append('description', 'Automated escrow smoke dispute');
          return fd;
        })(),
      });
      const disputedData = await disputed.json().catch(() => null);
      if ([200, 201].includes(disputed.status) && disputedData?.status === 'disputed') {
        ok('POST dispute → disputed');
      } else {
        fail(
          'POST dispute',
          `${disputed.status} ${JSON.stringify(disputedData).slice(0, 250)}`,
        );
      }
      const refunded = await req('POST', `/api/escrow/${eid}/refund`, {
        token: sellerToken,
        body: { note: 'smoke refund' },
      });
      if ([200, 201].includes(refunded.status) && refunded.data.status === 'refunded') {
        ok('POST refund → refunded');
      } else {
        fail('POST refund', `${refunded.status} ${JSON.stringify(refunded.data).slice(0, 250)}`);
      }
      await req('DELETE', `/api/listings/${lid}`, { token: sellerToken });
    } catch (e) {
      fail('dispute/refund branch', e.message);
    }
  }

  // cleanup happy-path listing if still present
  if (sellerToken && listingId) {
    try {
      await req('DELETE', `/api/listings/${listingId}`, { token: sellerToken });
      ok('cleanup happy-path listing');
    } catch (e) {
      // may fail if sold/locked — not critical
      ok('cleanup listing skipped', e.message.slice(0, 80));
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n======== ${passed} passed, ${failed} failed (of ${results.length}) ========\n`);
  if (failed) {
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
