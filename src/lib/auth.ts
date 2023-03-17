import { hash, verify } from "@node-rs/argon2";
import { navigate, runSSM, useQueryClient, useSSQ } from "rakkasjs";
import { useEffect } from "react";
import { prisma } from "src/prisma";

export type UseAuthSessionOptions = {
  disableRedirect?: boolean;
};

const defaultOptions = {
  disableRedirect: true,
};
const argon2Opts = {
  memory: 3145728,
  iterations: 2,
  parallelism: 64,
  salt_length: 16,
  key_length: 32,
};
export function useAuth(options: UseAuthSessionOptions = defaultOptions) {
  const queryClient = useQueryClient();
  const methods = useSSQ(
    async (ctx) => {
      const user = ctx.locals.user;

      if (!user) {
        return {
          valid: false,
        } as const;
      }

      return {
        user,
        roles: [],
        permissions: [],
        valid: true,
      } as const;
    },
    {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  const signOut = async () => {
    await runSSM((ctx) => {
      ctx.session.destroy();
    });

    queryClient.invalidateQueries();
  };

  const signIn = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const res = await runSSM(async (ctx) => {
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        return {
          status: "WRONG_CREDENTIALS_ERROR",
        } as const;
      }

      const valid = await verify(user.password, password, argon2Opts);

      if (!valid) {
        return {
          status: "WRONG_CREDENTIALS_ERROR",
        } as const;
      }

      ctx.session.data = {
        userId: user.id,
      };

      return {
        status: "OK",
      } as const;
    });

    queryClient.invalidateQueries();
    return res;
  };

  const signUp = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const res = await runSSM(async (ctx) => {
      const user = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (user) {
        return {
          status: "EMAIL_ALREADY_EXISTS_ERROR",
        } as const;
      }

      const hashed = await hash(password, argon2Opts);
      const created = await prisma.user.create({
        data: {
          email,
          password: hashed,
        },
      });

      ctx.locals.user = created;
      ctx.session.data = {
        userId: created.id,
      };

      return {
        status: "OK",
      } as const;
    });

    queryClient.invalidateQueries();
    return res;
  };

  useEffect(() => {
    if (!methods.data.valid && !options.disableRedirect) {
      navigate("/auth/signin");
    }
  }, [methods.data.valid, options]);

  return { ...methods, session: methods.data, signOut, signIn, signUp };
}
