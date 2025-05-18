import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function ArrayMinLength(
  min: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'arrayMinLength',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [min],
      options: validationOptions,
      validator: {
        validate(value: any) {
          return Array.isArray(value) && value.length >= min;
        },
        defaultMessage(args: ValidationArguments) {
          const min: number =
            Array.isArray(args.constraints) &&
            typeof args.constraints[0] === 'number'
              ? args.constraints[0]
              : 1;
          return `${args.property} must contain at least ${min} element(s)`;
        },
      },
    });
  };
}
