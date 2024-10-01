{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    nix-deno.url = "github:wanderer/nix-deno";
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    nix-deno,
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
        _module.args.pkgs = import inputs.nixpkgs {
          inherit system;
          overlays = [inputs.nix-deno.overlays.default];
        };
        packages.default = pkgs.denoPlatform.mkDenoBinary {
          name = "s2bc";
          version = "0.0.1";
          src = ./.;
          permissions.allow.all = true;
        };
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            deno
          ];
        };
      };
    };
}
