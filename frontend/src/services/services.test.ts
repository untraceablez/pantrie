/**
 * Unit tests for the API service layer.
 *
 * Every service module is a thin wrapper over the shared `apiClient`, so we
 * mock `@/services/api` (which each service imports via `'./api'` — the same
 * resolved module) and assert each function hits the right URL/verb/payload
 * and returns `response.data`. Pure helpers (allergen matching) are tested
 * directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  defaults: { baseURL: 'http://api.test/api/v1' },
}))

vi.mock('@/services/api', () => ({ apiClient: mockApi }))

// Resolve every verb to a sentinel by default; individual tests override.
const data = <T>(payload: T) => ({ data: payload })

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.get.mockResolvedValue(data({}))
  mockApi.post.mockResolvedValue(data({}))
  mockApi.put.mockResolvedValue(data({}))
  mockApi.patch.mockResolvedValue(data({}))
  mockApi.delete.mockResolvedValue(data(undefined))
})

// --------------------------------------------------------------------------- //
// allergen
// --------------------------------------------------------------------------- //
describe('allergen service', () => {
  it('lists, creates, and deletes allergens', async () => {
    const mod = await import('./allergen')
    mockApi.get.mockResolvedValue(data([{ id: 1, name: 'peanut' }]))
    expect(await mod.listHouseholdAllergens(7)).toEqual([{ id: 1, name: 'peanut' }])
    expect(mockApi.get).toHaveBeenCalledWith('/households/7/allergens')

    mockApi.post.mockResolvedValue(data({ id: 2, name: 'milk' }))
    expect(await mod.createAllergen(7, { name: 'milk' })).toEqual({ id: 2, name: 'milk' })
    expect(mockApi.post).toHaveBeenCalledWith('/households/7/allergens', { name: 'milk' })

    await mod.deleteAllergen(2)
    expect(mockApi.delete).toHaveBeenCalledWith('/households/allergens/2')
  })

  it('checkIngredientsForAllergens matches on word boundaries, case-insensitively', async () => {
    const { checkIngredientsForAllergens } = await import('./allergen')
    const allergens = [
      { id: 1, household_id: 1, name: 'Milk', created_at: '', updated_at: '' },
      { id: 2, household_id: 1, name: 'Soy', created_at: '', updated_at: '' },
    ]
    expect(checkIngredientsForAllergens('Contains MILK and water', allergens)).toEqual(['Milk'])
    // "Soybean" should NOT match "Soy" due to the word boundary
    expect(checkIngredientsForAllergens('soybean oil', allergens)).toEqual([])
  })

  it('checkIngredientsForAllergens returns [] for empty inputs', async () => {
    const { checkIngredientsForAllergens } = await import('./allergen')
    expect(checkIngredientsForAllergens(null, [{ id: 1, household_id: 1, name: 'x', created_at: '', updated_at: '' }])).toEqual([])
    expect(checkIngredientsForAllergens('milk', [])).toEqual([])
  })
})

// --------------------------------------------------------------------------- //
// apiClients
// --------------------------------------------------------------------------- //
describe('apiClients service', () => {
  it('lists, creates, and revokes api clients', async () => {
    const mod = await import('./apiClients')
    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    expect(await mod.listApiClients(3)).toEqual([{ id: 1 }])
    expect(mockApi.get).toHaveBeenCalledWith('/households/3/api-clients')

    mockApi.post.mockResolvedValue(data({ id: 9, client_secret: 's' }))
    const created = await mod.createApiClient(3, { name: 'cli' })
    expect(created.client_secret).toBe('s')
    expect(mockApi.post).toHaveBeenCalledWith('/households/3/api-clients', { name: 'cli' })

    await mod.revokeApiClient(3, 9)
    expect(mockApi.delete).toHaveBeenCalledWith('/households/3/api-clients/9')
  })
})

// --------------------------------------------------------------------------- //
// auth
// --------------------------------------------------------------------------- //
describe('auth service', () => {
  it('register / refreshToken / logout / getCurrentUser / getOAuthProviders', async () => {
    const mod = await import('./auth')

    mockApi.post.mockResolvedValue(data({ id: 1, email: 'a@b.c' }))
    expect(await mod.register({ email: 'a@b.c', username: 'a', password: 'p' })).toEqual({ id: 1, email: 'a@b.c' })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', { email: 'a@b.c', username: 'a', password: 'p' })

    mockApi.post.mockResolvedValue(data({ access_token: 'x' }))
    expect(await mod.refreshToken('rt')).toEqual({ access_token: 'x' })
    expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', { refresh_token: 'rt' })

    await mod.logout('rt')
    expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', { refresh_token: 'rt' })

    mockApi.get.mockResolvedValue(data({ id: 5 }))
    expect(await mod.getCurrentUser()).toEqual({ id: 5 })
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me')

    mockApi.get.mockResolvedValue(data({ providers: ['google', 'authentik'] }))
    expect(await mod.getOAuthProviders()).toEqual(['google', 'authentik'])
  })

  it('login posts credentials then fetches /auth/me and merges the result', async () => {
    const mod = await import('./auth')
    mockApi.post.mockResolvedValue(data({ access_token: 'tok', refresh_token: 'r', token_type: 'bearer', expires_in: 60 }))
    mockApi.get.mockResolvedValue(data({ id: 1, email: 'a@b.c' }))

    const result = await mod.login({ email: 'a@b.c', password: 'p' })
    expect(result.user).toEqual({ id: 1, email: 'a@b.c' })
    expect(result.access_token).toBe('tok')
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'p' })
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me', { headers: { Authorization: 'Bearer tok' } })
  })

  it('initiateOAuth redirects the browser to the authorize URL', async () => {
    const mod = await import('./auth')
    const original = window.location
    // @ts-expect-error override read-only location for the test
    delete window.location
    // @ts-expect-error minimal location stub
    window.location = { href: '' }

    mod.initiateOAuth('google', 'https://front/cb')
    expect(window.location.href).toBe(
      'http://api.test/api/v1/auth/oauth/google/authorize?redirect_uri=https%3A%2F%2Ffront%2Fcb'
    )

    // @ts-expect-error restore
    window.location = original
  })
})

// --------------------------------------------------------------------------- //
// barcode
// --------------------------------------------------------------------------- //
describe('barcode service', () => {
  it('looks up a barcode', async () => {
    const mod = await import('./barcode')
    mockApi.get.mockResolvedValue(data({ name: 'Beans' }))
    expect(await mod.lookupBarcode('555')).toEqual({ name: 'Beans' })
    expect(mockApi.get).toHaveBeenCalledWith('/barcode/555')
  })
})

// --------------------------------------------------------------------------- //
// email
// --------------------------------------------------------------------------- //
describe('email service', () => {
  it('confirms email and verifies tokens', async () => {
    const { emailService } = await import('./email')
    mockApi.post.mockResolvedValue(data({ success: true, message: 'ok' }))
    expect(await emailService.confirmEmail('tok')).toEqual({ success: true, message: 'ok' })
    expect(mockApi.post).toHaveBeenCalledWith('/email/confirm', { token: 'tok' })

    mockApi.get.mockResolvedValue(data({ valid: true }))
    expect(await emailService.verifyToken('tok')).toEqual({ valid: true })
    expect(mockApi.get).toHaveBeenCalledWith('/email/verify-token/tok')
  })
})

// --------------------------------------------------------------------------- //
// household
// --------------------------------------------------------------------------- //
describe('household service', () => {
  it('covers create/list/get/update/delete', async () => {
    const mod = await import('./household')
    mockApi.post.mockResolvedValue(data({ id: 1, name: 'Home' }))
    expect(await mod.createHousehold({ name: 'Home' })).toEqual({ id: 1, name: 'Home' })
    expect(mockApi.post).toHaveBeenCalledWith('/households', { name: 'Home' })

    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    expect(await mod.listHouseholds()).toEqual([{ id: 1 }])
    expect(mockApi.get).toHaveBeenCalledWith('/households')

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    expect(await mod.getHousehold(1)).toEqual({ id: 1 })
    expect(mockApi.get).toHaveBeenCalledWith('/households/1')

    mockApi.put.mockResolvedValue(data({ id: 1, name: 'New' }))
    expect(await mod.updateHousehold(1, { name: 'New' })).toEqual({ id: 1, name: 'New' })
    expect(mockApi.put).toHaveBeenCalledWith('/households/1', { name: 'New' })

    await mod.deleteHousehold(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/households/1')
  })
})

// --------------------------------------------------------------------------- //
// householdMembers
// --------------------------------------------------------------------------- //
describe('householdMembers service', () => {
  it('lists/adds/updates-role/removes members', async () => {
    const mod = await import('./householdMembers')
    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    expect(await mod.listHouseholdMembers(2)).toEqual([{ id: 1 }])
    expect(mockApi.get).toHaveBeenCalledWith('/households/2/members')

    mockApi.post.mockResolvedValue(data({ id: 3 }))
    await mod.addHouseholdMember(2, { email: 'x@y.z', role: 'editor' })
    expect(mockApi.post).toHaveBeenCalledWith('/households/2/members', { email: 'x@y.z', role: 'editor' })

    mockApi.patch.mockResolvedValue(data({ id: 3, role: 'admin' }))
    expect(await mod.updateMemberRole(2, 3, { role: 'admin' })).toEqual({ id: 3, role: 'admin' })
    expect(mockApi.patch).toHaveBeenCalledWith('/households/2/members/3', { role: 'admin' })

    await mod.removeMember(2, 3)
    expect(mockApi.delete).toHaveBeenCalledWith('/households/2/members/3')
  })
})

// --------------------------------------------------------------------------- //
// inventory
// --------------------------------------------------------------------------- //
describe('inventory service', () => {
  it('covers create/get/listHousehold/list/update/delete', async () => {
    const mod = await import('./inventory')
    mockApi.post.mockResolvedValue(data({ id: 1 }))
    await mod.createItem({ household_id: 1, name: 'Eggs', quantity: 12 })
    expect(mockApi.post).toHaveBeenCalledWith('/inventory', { household_id: 1, name: 'Eggs', quantity: 12 })

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    await mod.getItem(1)
    expect(mockApi.get).toHaveBeenCalledWith('/inventory/1')

    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    await mod.listHouseholdItems(5)
    expect(mockApi.get).toHaveBeenCalledWith('/inventory/households/5')

    mockApi.get.mockResolvedValue(data({ items: [], total: 0 }))
    await mod.listInventory(5, { page: 2, search: 'egg' })
    expect(mockApi.get).toHaveBeenCalledWith('/inventory/households/5/list', { params: { page: 2, search: 'egg' } })

    mockApi.put.mockResolvedValue(data({ id: 1, name: 'X' }))
    await mod.updateItem(1, { name: 'X' })
    expect(mockApi.put).toHaveBeenCalledWith('/inventory/1', { name: 'X' })

    await mod.deleteItem(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/inventory/1')
  })
})

// --------------------------------------------------------------------------- //
// location
// --------------------------------------------------------------------------- //
describe('location service', () => {
  it('covers create/get/listHousehold/update/delete', async () => {
    const mod = await import('./location')
    mockApi.post.mockResolvedValue(data({ id: 1 }))
    await mod.createLocation({ household_id: 1, name: 'Pantry' })
    expect(mockApi.post).toHaveBeenCalledWith('/locations', { household_id: 1, name: 'Pantry' })

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    await mod.getLocation(1)
    expect(mockApi.get).toHaveBeenCalledWith('/locations/1')

    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    await mod.listHouseholdLocations(4)
    expect(mockApi.get).toHaveBeenCalledWith('/locations/households/4')

    mockApi.put.mockResolvedValue(data({ id: 1 }))
    await mod.updateLocation(1, { name: 'Fridge' })
    expect(mockApi.put).toHaveBeenCalledWith('/locations/1', { name: 'Fridge' })

    await mod.deleteLocation(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/locations/1')
  })
})

// --------------------------------------------------------------------------- //
// mealie
// --------------------------------------------------------------------------- //
describe('mealie service', () => {
  it('returns the connection on success', async () => {
    const mod = await import('./mealie')
    mockApi.get.mockResolvedValue(data({ id: 1, base_url: 'http://m' }))
    expect(await mod.getMealieConnection(6)).toEqual({ id: 1, base_url: 'http://m' })
    expect(mockApi.get).toHaveBeenCalledWith('/households/6/mealie/connection')
  })

  it('returns null when the connection is a 404', async () => {
    const mod = await import('./mealie')
    mockApi.get.mockRejectedValue({ response: { status: 404 } })
    expect(await mod.getMealieConnection(6)).toBeNull()
  })

  it('rethrows non-404 errors', async () => {
    const mod = await import('./mealie')
    mockApi.get.mockRejectedValue({ response: { status: 500 } })
    await expect(mod.getMealieConnection(6)).rejects.toEqual({ response: { status: 500 } })
  })

  it('configures/deletes connection, lists recipes, pushes shopping list', async () => {
    const mod = await import('./mealie')
    mockApi.put.mockResolvedValue(data({ id: 1 }))
    await mod.configureMealieConnection(6, { base_url: 'http://m', api_key: 'k' })
    expect(mockApi.put).toHaveBeenCalledWith('/households/6/mealie/connection', { base_url: 'http://m', api_key: 'k' })

    await mod.deleteMealieConnection(6)
    expect(mockApi.delete).toHaveBeenCalledWith('/households/6/mealie/connection')

    mockApi.get.mockResolvedValue(data({ recipes: [] }))
    await mod.getMealieRecipes(6)
    expect(mockApi.get).toHaveBeenCalledWith('/households/6/mealie/recipes')

    mockApi.post.mockResolvedValue(data({ requested: 1, added: 1, items: [] }))
    await mod.pushToShoppingList(6, ['milk'])
    expect(mockApi.post).toHaveBeenCalledWith('/households/6/mealie/shopping-list', { items: ['milk'] })
  })
})

// --------------------------------------------------------------------------- //
// notifications
// --------------------------------------------------------------------------- //
describe('notifications service', () => {
  it('covers email settings + webhook CRUD + test', async () => {
    const { notificationService } = await import('./notifications')
    mockApi.get.mockResolvedValue(data({ email_notifications_enabled: false }))
    await notificationService.getEmailSettings()
    expect(mockApi.get).toHaveBeenCalledWith('/notifications/email')

    mockApi.put.mockResolvedValue(data({ email_notifications_enabled: true }))
    await notificationService.updateEmailSettings({
      email_notifications_enabled: true, notify_expiring_items: true, notify_low_stock: true,
      notify_new_member: true, expiry_warning_days: 7,
    })
    expect(mockApi.put).toHaveBeenCalledWith('/notifications/email', expect.objectContaining({ email_notifications_enabled: true }))

    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    await notificationService.listWebhooks()
    expect(mockApi.get).toHaveBeenCalledWith('/notifications/webhooks')

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    await notificationService.getWebhook(1)
    expect(mockApi.get).toHaveBeenCalledWith('/notifications/webhooks/1')

    mockApi.post.mockResolvedValue(data({ id: 2 }))
    await notificationService.createWebhook({ name: 'w', url: 'https://h', event_types: ['low_stock'] })
    expect(mockApi.post).toHaveBeenCalledWith('/notifications/webhooks', expect.objectContaining({ name: 'w' }))

    mockApi.put.mockResolvedValue(data({ id: 1, name: 'w2' }))
    await notificationService.updateWebhook(1, { name: 'w2' })
    expect(mockApi.put).toHaveBeenCalledWith('/notifications/webhooks/1', { name: 'w2' })

    await notificationService.deleteWebhook(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/notifications/webhooks/1')

    mockApi.post.mockResolvedValue(data({ success: true, message: 'ok' }))
    expect(await notificationService.testWebhook(1)).toEqual({ success: true, message: 'ok' })
    expect(mockApi.post).toHaveBeenCalledWith('/notifications/webhooks/1/test')
  })
})

// --------------------------------------------------------------------------- //
// setupService
// --------------------------------------------------------------------------- //
describe('setup service', () => {
  it('checks status and performs initial setup', async () => {
    const { setupService } = await import('./setupService')
    mockApi.get.mockResolvedValue(data({ setup_complete: false, message: '' }))
    expect(await setupService.checkSetupStatus()).toEqual({ setup_complete: false, message: '' })
    expect(mockApi.get).toHaveBeenCalledWith('/setup/status')

    mockApi.post.mockResolvedValue(data({ message: 'done', household: { id: 1, name: 'H' }, user: { id: 1, email: '', username: '' } }))
    await setupService.performInitialSetup({
      admin_email: 'a@b.c', admin_username: 'a', admin_password: 'p', household_name: 'H',
    })
    expect(mockApi.post).toHaveBeenCalledWith('/setup/initialize', expect.objectContaining({ household_name: 'H' }))
  })
})

// --------------------------------------------------------------------------- //
// siteAdmin
// --------------------------------------------------------------------------- //
describe('siteAdmin service', () => {
  it('covers user management endpoints', async () => {
    const { siteAdminService } = await import('./siteAdmin')
    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    await siteAdminService.listUsers()
    expect(mockApi.get).toHaveBeenCalledWith('/site-admin/users')

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    await siteAdminService.getUser(1)
    expect(mockApi.get).toHaveBeenCalledWith('/site-admin/users/1')

    mockApi.post.mockResolvedValue(data({ id: 2 }))
    await siteAdminService.createUser({ email: 'a@b.c', username: 'a', password: 'p' })
    expect(mockApi.post).toHaveBeenCalledWith('/site-admin/users', expect.objectContaining({ email: 'a@b.c' }))

    mockApi.put.mockResolvedValue(data({ id: 1 }))
    await siteAdminService.updateUser(1, { first_name: 'F' })
    expect(mockApi.put).toHaveBeenCalledWith('/site-admin/users/1', { first_name: 'F' })

    await siteAdminService.deleteUser(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/site-admin/users/1')
  })

  it('covers household management endpoints', async () => {
    const { siteAdminService } = await import('./siteAdmin')
    mockApi.get.mockResolvedValue(data([{ id: 1 }]))
    await siteAdminService.listHouseholds()
    expect(mockApi.get).toHaveBeenCalledWith('/site-admin/households')

    mockApi.get.mockResolvedValue(data({ id: 1 }))
    await siteAdminService.getHousehold(1)
    expect(mockApi.get).toHaveBeenCalledWith('/site-admin/households/1')

    mockApi.post.mockResolvedValue(data({ id: 2 }))
    await siteAdminService.createHousehold({ name: 'H', admin_user_id: 1 })
    expect(mockApi.post).toHaveBeenCalledWith('/site-admin/households', { name: 'H', admin_user_id: 1 })

    mockApi.put.mockResolvedValue(data({ id: 1 }))
    await siteAdminService.updateHousehold(1, { name: 'H2' })
    expect(mockApi.put).toHaveBeenCalledWith('/site-admin/households/1', { name: 'H2' })

    await siteAdminService.deleteHousehold(1)
    expect(mockApi.delete).toHaveBeenCalledWith('/site-admin/households/1')
  })
})

// --------------------------------------------------------------------------- //
// siteSettings
// --------------------------------------------------------------------------- //
describe('siteSettings service', () => {
  it('gets/updates smtp and proxy settings', async () => {
    const { siteSettingsService } = await import('./siteSettings')
    mockApi.get.mockResolvedValue(data({ smtp_host: null }))
    await siteSettingsService.getSMTPSettings()
    expect(mockApi.get).toHaveBeenCalledWith('/site-settings/smtp')

    mockApi.put.mockResolvedValue(data({ smtp_host: 'smtp.x' }))
    await siteSettingsService.updateSMTPSettings({
      smtp_host: 'smtp.x', smtp_port: 587, smtp_from_email: 'f@x', smtp_from_name: 'P',
      smtp_use_tls: true, require_email_confirmation: true,
    })
    expect(mockApi.put).toHaveBeenCalledWith('/site-settings/smtp', expect.objectContaining({ smtp_host: 'smtp.x' }))

    mockApi.get.mockResolvedValue(data({ proxy_mode: 'none' }))
    await siteSettingsService.getProxySettings()
    expect(mockApi.get).toHaveBeenCalledWith('/site-settings/proxy')

    mockApi.put.mockResolvedValue(data({ proxy_mode: 'builtin' }))
    await siteSettingsService.updateProxySettings({ proxy_mode: 'builtin', use_https: true })
    expect(mockApi.put).toHaveBeenCalledWith('/site-settings/proxy', expect.objectContaining({ proxy_mode: 'builtin' }))
  })
})

// --------------------------------------------------------------------------- //
// user
// --------------------------------------------------------------------------- //
describe('user service', () => {
  it('gets/updates the current user and changes password', async () => {
    const mod = await import('./user')
    mockApi.get.mockResolvedValue(data({ id: 1, username: 'me' }))
    expect(await mod.getCurrentUser()).toEqual({ id: 1, username: 'me' })
    expect(mockApi.get).toHaveBeenCalledWith('/users/me')

    mockApi.put.mockResolvedValue(data({ id: 1, first_name: 'Ada' }))
    await mod.updateCurrentUser({ first_name: 'Ada' })
    expect(mockApi.put).toHaveBeenCalledWith('/users/me', { first_name: 'Ada' })

    await mod.changePassword({ current_password: 'a', new_password: 'b' })
    expect(mockApi.post).toHaveBeenCalledWith('/users/me/password', { current_password: 'a', new_password: 'b' })
  })

  it('uploads an avatar as multipart form data', async () => {
    const mod = await import('./user')
    mockApi.post.mockResolvedValue(data({ avatar_url: 'data:image/png;base64,..' }))
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' })
    const result = await mod.uploadAvatar(file)
    expect(result.avatar_url).toContain('data:image/png')

    const [url, body, config] = mockApi.post.mock.calls[0]
    expect(url).toBe('/users/me/avatar')
    expect(body).toBeInstanceOf(FormData)
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })
})
