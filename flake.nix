{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:aMOPel/nixpkgs/feat/buildDenoPackage-second";
    flake-parts.url = "github:hercules-ci/flake-parts";
    systems.url = "github:nix-systems/default";
    pre-commit-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    flake-parts,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = import inputs.systems;
      imports = [
        inputs.pre-commit-hooks.flakeModule
      ];
      perSystem = {
        pkgs,
        config,
        ...
      }: {
        pre-commit = {
          check.enable = true;
          settings = {
            src = ./.;
            hooks = {
              alejandra.enable = true;
              typos = {
                # this tell typos not to check excluded files even if pre-commit tell typos to check them
                args = ["--force-exclude"];
                enable = true;
              };
              #TODO: tries to download modules on nix flake check
              denolint = {
                enable = true;
                settings.configPath = "./deno.json";
              };
              denofmt = {
                enable = true;
                settings.configPath = "./deno.json";
              };
            };
          };
        };
        packages.default = pkgs.buildDenoPackage {
          pname = "safe-to-beancount";
          version = "0.0.0";
          denoDepsHash = "sha256-xlI1kg/K5ONcTBWFQ+Uu2U8XpfurFHKIQkt2nHinx70=";
          src = ./.;
          binaryEntrypointPath = "./main.ts";
          denoCompileFlags = [
            "--allow-env"
            "--allow-net"
          ];
        };
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs;
            [
              typos-lsp # code spell checker
            ]
            ++ config.pre-commit.settings.enabledPackages;

          shellHook = ''
            ${config.pre-commit.settings.installationScript}
          '';
        };
      };
    };
}
