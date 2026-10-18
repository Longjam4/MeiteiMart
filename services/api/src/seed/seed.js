import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import { ROLES, DEFAULT_ROLE_PERMISSIONS, ROLE_PORTALS, DEFAULT_CATEGORIES, CUSTOMER_SERVICES } from "@meiteimart/shared";
import { Role } from "../modules/roles/role.model.js";
import { User } from "../modules/users/user.model.js";
import { Category } from "../modules/categories/category.model.js";
import { Service } from "../modules/services/service.model.js";
import { env } from "../config/env.js";

async function seedRoles() {
  const roles = {};
  for (const roleName of Object.values(ROLES)) {
    const role = await Role.findOneAndUpdate(
      { name: roleName },
      {
        name: roleName,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName],
        portals: ROLE_PORTALS[roleName],
        isSystem: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    roles[roleName] = role;
    console.log(`[seed] Role ready: ${roleName} (${role.permissions.length} permissions)`);
  }
  return roles;
}

async function seedSuperAdmin(roles) {
  if (!env.superAdmin.email && !env.superAdmin.phone) {
    console.log("[seed] Skipping Super Admin — set SUPER_ADMIN_EMAIL or SUPER_ADMIN_PHONE in .env");
    return;
  }

  const [emailUser, phoneUser] = await Promise.all([
    env.superAdmin.email ? User.findOne({ email: env.superAdmin.email }) : null,
    env.superAdmin.phone ? User.findOne({ phone: env.superAdmin.phone }) : null,
  ]);

  if (emailUser && phoneUser && !emailUser._id.equals(phoneUser._id)) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PHONE belong to different users");
  }

  const existing = emailUser || phoneUser;
  if (existing) {
    existing.name = env.superAdmin.name;
    existing.email = env.superAdmin.email || existing.email;
    existing.phone = env.superAdmin.phone || existing.phone;
    existing.role = roles[ROLES.SUPER_ADMIN]._id;
    existing.isSuperAdmin = true;
    existing.isEmailVerified = true;
    existing.isPhoneVerified = true;
    await existing.save();
    console.log(`[seed] Super Admin account restored: ${env.superAdmin.email || env.superAdmin.phone}`);
    return;
  }
  await User.create({
    name: env.superAdmin.name,
    email: env.superAdmin.email || undefined,
    phone: env.superAdmin.phone || undefined,
    role: roles[ROLES.SUPER_ADMIN]._id,
    isSuperAdmin: true,
    isEmailVerified: true,
    isPhoneVerified: true,
  });
  console.log(`[seed] Super Admin created: ${env.superAdmin.email || env.superAdmin.phone}`);
}

async function seedCategories() {
  for (const cat of DEFAULT_CATEGORIES) {
    const parent = await Category.findOneAndUpdate(
      { slug: cat.slug },
      { name: cat.name, slug: cat.slug },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    for (const sub of cat.subcategories) {
      const subSlug = `${cat.slug}-${sub.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      await Category.findOneAndUpdate(
        { slug: subSlug },
        { name: sub, slug: subSlug, parent: parent._id },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }
  console.log(`[seed] Seeded ${DEFAULT_CATEGORIES.length} top-level categories with subcategories`);
}

async function seedServices() {
  for (const [index, service] of CUSTOMER_SERVICES.entries()) {
    await Service.findOneAndUpdate(
      { slug: service.slug },
      {
        $setOnInsert: {
          ...service,
          sortOrder: index,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`[seed] Seeded ${CUSTOMER_SERVICES.length} customer services`);
}

async function run() {
  await connectDB();
  const roles = await seedRoles();
  await seedSuperAdmin(roles);
  await seedCategories();
  await seedServices();
  await disconnectDB();
  console.log("[seed] Done.");
}

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
