module.exports = {
    env: {
        node: true,
        es2021: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking", // 启用类型感知的规则
        "plugin:prettier/recommended",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"], // 指向 tsconfig.json
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
        "@typescript-eslint/no-floating-promises": "error", // 禁止未处理的 Promise
        "@typescript-eslint/strict-boolean-expressions": "warn", // 要求布尔表达式更严格
    },
};
