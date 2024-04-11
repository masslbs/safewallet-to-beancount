{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    flake-parts,
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin"];
      perSystem = {
        config,
        self',
        inputs',
        pkgs,
        system,
        ...
      }: {
        packages.default = pkgs.buildNpmPackage {
          pname = "sw2bc";
          version = "0.1.0";
          src = ./.;
          nativeBuildInputs = [pkgs.nodePackages.typescript];
          buildInputs = [
            pkgs.typescript
          ];
          meta = {
            description = "A very basic package";
            license = "MIT";
          };
        };
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodePackages.pnpm
            nodejs
            typescript
            nodePackages.ts-node
          ];
        };
      };
    };
}
