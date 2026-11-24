import { useState } from "react";

const availableRoles = ["student", "instructor", "admin"];

async function request(token, path, method = "GET", body) {
  const response = await fetch("/api/admin/users" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected response. Check the backend server.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export default function AdminUsers({ token }) {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const busy = loading || Boolean(pendingId);

  async function loadUsers() {
    if (busy) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request(token, "");
      setUsers(data.users);
      setCurrentUserId(data.currentUserId);
      setLoaded(true);
      setDeletingId("");
      setConfirmEmail("");
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  function changeUser(userId, changes) {
    setUsers((previous) =>
      previous.map((user) =>
        user.id === userId ? { ...user, ...changes } : user
      )
    );
  }

  function toggleRole(user, role) {
    const roles = user.roles.includes(role)
      ? user.roles.filter((value) => value !== role)
      : [...user.roles, role];

    changeUser(user.id, { roles });
  }

  async function saveUser(user) {
    if (busy) return;

    if (user.roles.length === 0) {
      setError("Select at least one role.");
      setMessage("");
      return;
    }

    setPendingId(user.id);
    setError("");
    setMessage("");

    try {
      const data = await request(token, "/" + user.id, "PATCH", {
        is_active: user.is_active,
        roles: user.roles,
      });

      setMessage(user.full_name + ": " + data.message);
    } catch (err) {
      setError(err.message || "Could not update user.");
    } finally {
      setPendingId("");
    }
  }

  function startDeletion(user) {
    setDeletingId(user.id);
    setConfirmEmail("");
    setError("");
    setMessage("");
  }

  async function deleteUser(user) {
    if (busy) return;

    if (
      confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      setError("Type this user's email exactly to confirm deletion.");
      return;
    }

    setPendingId(user.id);
    setError("");
    setMessage("");

    try {
      const data = await request(token, "/" + user.id, "DELETE", {
        confirmEmail: confirmEmail.trim(),
      });

      setUsers((previous) =>
        previous.filter((item) => item.id !== user.id)
      );

      setDeletingId("");
      setConfirmEmail("");
      setMessage(user.full_name + ": " + data.message);
    } catch (err) {
      setError(err.message || "Could not delete user.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <section>
      <h3>User management</h3>

      <button type="button" onClick={loadUsers} disabled={busy}>
        {loading ? "Loading..." : "Load users"}
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loaded && users.length === 0 && <p>No users found.</p>}

      {users.map((user) => {
        const isSelf = user.id === currentUserId;

        return (
          <article
            key={user.id}
            style={{
              background: "white",
              padding: 16,
              marginTop: 16,
              borderRadius: 10,
            }}
          >
            <h4>{user.full_name}</h4>
            <p>{user.email}</p>

            {isSelf && <p>Your account — editing disabled.</p>}

            <fieldset disabled={busy || isSelf}>
              <legend>Account settings</legend>

              <label>
                Status
                <select
                  value={user.is_active ? "active" : "suspended"}
                  onChange={(event) =>
                    changeUser(user.id, {
                      is_active: event.target.value === "active",
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>

              <p>Roles</p>

              {availableRoles.map((role) => (
                <label
                  key={role}
                  style={{ display: "block", marginBottom: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={user.roles.includes(role)}
                    onChange={() => toggleRole(user, role)}
                  />
                  {" " + role}
                </label>
              ))}

              <button type="button" onClick={() => saveUser(user)}>
                {pendingId === user.id ? "Saving..." : "Save changes"}
              </button>
            </fieldset>

            {!isSelf && (
              <div style={{ marginTop: 16 }}>
                {deletingId === user.id ? (
                  <>
                    <p>
                      Permanently deletes this account and any related
                      records configured for automatic deletion.
                      This cannot be undone. Accounts owning courses
                      and admin accounts are protected.
                    </p>

                    <label>
                      Type {user.email} to confirm
                      <input
                        type="email"
                        value={confirmEmail}
                        onChange={(event) =>
                          setConfirmEmail(event.target.value)
                        }
                        disabled={busy}
                        autoComplete="off"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        confirmEmail.trim().toLowerCase() !==
                          user.email.toLowerCase()
                      }
                      onClick={() => deleteUser(user)}
                    >
                      {pendingId === user.id
                        ? "Deleting..."
                        : "Permanently delete"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDeletingId("");
                        setConfirmEmail("");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startDeletion(user)}
                  >
                    Delete user
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}