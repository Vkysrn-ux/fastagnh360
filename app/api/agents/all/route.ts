import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Query users (with parent data)
    const { searchParams } = new URL(req.url);
    const rolesParam = searchParams.get("roles");
    let whereClause = "";
    let params = [];
    if (rolesParam) {
      const roles = rolesParam.split(",").map(r => r.trim()).filter(Boolean);
      if (roles.length) {
        whereClause = `WHERE u.role IN (${roles.map(() => "?").join(",")})`;
        params = roles;
      }
    }
    const [users] = await pool.query(
      `
      SELECT 
        u.id, u.name, u.role, u.phone, u.pincode, u.status,
        u.parent_user_id,
        p.name AS parent_name,
        p.role AS parent_role
      FROM users u
      LEFT JOIN users p ON u.parent_user_id = p.id
      ${whereClause}
      ORDER BY u.id DESC
      `,
      params
    );

    // 2. Query fastags assignments
    const [fastags] = await pool.query(
      `SELECT assigned_to AS user_id FROM fastags`
    );

    // 3. Build user map
    const userMap = {};
    users.forEach(u => userMap[u.id] = { ...u, children: [] });
    Object.values(userMap).forEach(user => {
      if (user.parent_user_id && userMap[user.parent_user_id]) {
        userMap[user.parent_user_id].children.push(user.id);
      }
    });

    // 4. Count fastags per user
    const fastagCount = {};
    fastags.forEach(f => {
      fastagCount[f.user_id] = (fastagCount[f.user_id] || 0) + 1;
    });

    // 5. Recursive descendant function
    function getAllDescendantIds(userId) {
      let ids = [userId];
      const children = userMap[userId]?.children || [];
      for (const childId of children) {
        ids = ids.concat(getAllDescendantIds(childId));
      }
      return ids;
    }

    function getTotalFastagsForUser(userId) {
      const allIds = getAllDescendantIds(userId);
      return allIds.reduce((sum, id) => sum + (fastagCount[id] || 0), 0);
    }

    // 6. Add total_fastags to user
    const usersWithFastags = users.map(user => ({
      ...user,
      total_fastags: getTotalFastagsForUser(user.id),
    }));

    return NextResponse.json(usersWithFastags);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
